exports.requireRole=(role)=>(req, res, next)=>{
    const r=req.user?.role

    if(r===role) return next()

    return res.status(403).json({message:'관리자 권한 필요'})
}