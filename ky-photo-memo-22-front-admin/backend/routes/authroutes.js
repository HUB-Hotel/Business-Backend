const express = require("express")
const router = express.Router()
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const User = require("../models/User")
const { authenticateToken } = require('../middlewares/auth'); // ✅ 변경됨: auth → authenticateToken 명시적 미들웨어 사용
const LOCK_MAX = 5
const LOCKOUT_DURATION_MS = 10*60*1000


function makeToken(user) {
    return jwt.sign(
        {
            id: user._id.toString(),
            role: user.role,
            email: user.email
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d",
            jwtid: `${user._id}-${Date.now()}`,
        }

    )
}

router.post("/register", async (req, res) => {
    try {
        const { email, password, displayName, role } = req.body

        if (!email || !password) {
            return res.status(400).json({ message: "이메일/비밀번호 필요" })
        }

        const exists = await User.findOne({
            email: email.toLowerCase()
        })
        if (exists) {

            return res.status(400).json({ message: "이미 가입된 이메일" })
        }

        const passwordHash = await bcrypt.hash(password, 10)

        const validRoles = ["user", "admin"]
        const safeRole = validRoles.includes(role) ? role : "user"

        const user = await User.create({
            email,
            displayName,
            passwordHash,
            role: safeRole
        })

        res.status(201).json({ user: user.toSafeJSON() })

    } catch (error) {
        return res.status(500).json({
            message: "회원가입 실패",
            error: error.message
        })

    }
})


router.post("/login", async (req, res) => {
    try {
        // 1) req.body에서 email, password를 꺼낸다(기본값은 빈 문자열).
        const email = String(req.body?.email|| "").toLowerCase()
        const password = String(req.body?.password?? "")
        
        const invalidMsg = { message: "이메일 또는 비밀번호가 올바르지 않습니다." };
        
        
        if(!email || !password){
            return res.status(400).json({
                ...invalidMsg,
                remainingAttempts:null,
                locked:false
            })
        }

        
        
        
        //  2) 이메일을 소문자로 바꿔 활성화된 유저(isActive: true)만 조회한다. .findOne() /.toLowerCase()

        const user = await User.findOne({email}).select(
              "+passwordHash +role +isActive +failedLoginAttempts +lastLoginAttempt"
        )



        // 3 사용자 없음
        if (!user) {
            return res.status(401).json({
                ...invalidMsg,
                loginAttempts: null,
                remainingAttempts: null,
                locked: false
            })
        }
        // 4 잠금 해제 로직

        if(!user.isActive){
            const last = user.lastLoginAttempt? user.lastLoginAttempt.getTime():0
            const passed = Date.now() -last;
            if(passed>LOCKOUT_DURATION_MS){
                user.isActive=true
                user.failedLoginAttempts=0
                user.lastLoginAttempt=null
                await user.save()
            }
        }
        // 5 여전히 잠금 상태면 로그인 불가
        if(!user.isActive){
             const last = user.lastLoginAttempt? user.lastLoginAttempt.getTime():0
             const remainMs= Math.max(0, LOCKOUT_DURATION_MS-(Date.now()-last))
             const remainMin=Math.ceil(remainMs/60000)

             return res.status(423).json({
                message:
                    remainMs>0
                    ? `계정이 잠금 상태입니다 약 ${remainMin}분후 다시 시도해 주세요`
                    :"계정이 잠금 상태입니다. 관리자에게 문의 하세요",
                locked:true
             })

        }

        // 6)비밀번호 검증 (User 모델에 comparePassword 메서드가 있다고 가정)
        const ok = 
        typeof user.comparePassword==='function'
         ? await user.comparePassword(password)
         : await bcrypt.compare(password, user.passwordHash || "")

        // 7)비밀번호 불일치
        if (!ok) {
            user.failedLoginAttempts += 1
            user.lastLoginAttempt= new Date()

            // 최대 횟수 초과 계정 잠금
            if (user.failedLoginAttempts >= LOCK_MAX) {
                user.isActive = false//잠금처리

                await user.save()

                return res.status(423).json({
                    message: "유효성 검증 실패로 계정이 잠겼습니다. 관리자에게 문의하세요.",
                    loginAttempts: user.failedLoginAttempts,
                    remainingAttempts: 0,
                    locked: true
                })
            }

            const remaining =Math.max(0,LOCK_MAX-user.failedLoginAttempts)
            await user.save()





            //  아직 잠금 전 400 현재 실패 남은 횟수 안내
            await user.save()
            return res.status(400).json({
                ...invalidMsg,
                loginAttempts: user.failedLoginAttempts,
                remainingAttempts: remaining,
                locked: false
            })
        }


        // 8.로그인 성공: 실패 카운트 초기화 접속 정보 업데이트

        user.failedLoginAttempts = 0
        user.lastLoginAttempt = new Date()

        await user.save()

        // 9 JWT 발급 및 쿠키 설정
        const token = makeToken(user)


        res.cookie('token', token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })


        // 10 성공 응답: 사용자 정보 +토큰+ 참조용 카운트 
        return res.status(200).json({
            user:typeof user.toSafeJSON()==='function'? user.toSafeJSON():{
                _id:user._id,
                email:user.email,
                displayName:user.displayName,
                role:user.role
            },
            token,
            loginAttempts: 0,
            remainingAttempts: LOCK_MAX,
            locked: false
        })

    } catch (error) {
        return res.status(500).json({
            message: "로그인 실패",
            error: error.message
        })
    }
})

router.use(authenticateToken)


router.get("/me", async (req, res) => {
    try {
        const me = await User.findById(req.user.id)

        if (!me) return res.status(404).json({ message: "사용자 없음" })

        return res.status(200).json(me.toSafeJSON())

    } catch (error) {

        res.status(401).json({ message: "조회 실패", error: error.message })
    }
})

router.get("/users", async (req, res) => {
    try {
        const me = await User.findById(req.user.id)
        if (!me) return res.status(404).json({ message: '사용자 없음' })


        if (me.role !== 'admin') {
            return res.status(403).json({ message: '권한 없음' })
        }
        const users = await User.find().select('-passwordHash')

        return res.status(200).json({ users })
    } catch (error) {
        res.status(401).json({ message: "조회 실패", error: error.message })

    }
})

router.post("/logout", async (req, res) => {
    try {
        await User.findByIdAndUpdate(
            req.user.id,
            { $set: { isLoggined: false }, },
            { new: true }
        )

        res.clearCookie('token', {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path:'/'
        })
        return res.status(200).json({ message: '로그아웃 성공' })
    } catch (error) {

        return res.status(500).json({ message: '로그아웃 실패', error: error.message })
    }
})

module.exports = router