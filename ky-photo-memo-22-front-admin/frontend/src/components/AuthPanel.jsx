import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './style/AuthPanel.scss'
import AuthModal from "./AuthModal"

const AuthPanel = ({
  isAuthed,
  user,
  me,
  onFetchMe,
  onLogout,
  onAuthed,
  requiredRole
}) => {

  const [open, setOpen] = useState(true)
  const hasRequiredRole = !requiredRole || (user && user.role == requiredRole)
  const navigate = useNavigate()

  const isAdminPage = requiredRole === 'admin'
  const title = isAdminPage ? '관리자인증' : '로그인'


  useEffect(() => {
    if (!isAuthed || !user) return

    if (isAdminPage) {
      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else {

        navigate('/user/dashboard', { replace: true })
      }
    } else {
      navigate('/user/dashboard', { replace: true })
    }
  }, [isAuthed, user, isAdminPage, navigate])

  if (!open) {
    return (
      <section className='admin-wrap'>
        <div className="inner">

          <header className='admin-head'>
            <h1 className='title'>관리자 인증</h1>
            <p>
              버튼 → 모달에서 로그인/회원가입 → 토큰 저장 → /me 호출
            </p>
          </header>
          {!isAuthed ? (
            <div className="auth-row">
              {/* 로그인 전 */}
              <button
                onClick={() => setOpen(true)}
                className="btn btn-primary">
                로그인 / 회원가입
              </button>

            </div>
          ) : (
            <div className="auth-row">
              {/* 로그인 후 */}
              <span>안녕하세요 <b>{user?.displayName || user?.email}</b> </span>
              <span
                className={`badge ${hasRequiredRole ? 'badge-ok' : 'badge-warn'} `}>
                {hasRequiredRole ? 'admin' : `권한없음 : ${requiredRole} 필요`}
              </span>

              <div className="auth-actions">

                {hasRequiredRole && (
                  <button className="btn" onClick={onFetchMe}>/me 호출</button>
                )}
                <button className="btn" onClick={onLogout}>로그아웃</button>
              </div>
            </div>
          )}



          {/* 권한 없음 경고 */}
          {!hasRequiredRole && (
            <div className="alert alert-warn">
              현재 계정에는 관리자 권한이 없습니다. 관리자 승인이 필요합니다.
            </div>
          )}

          {/* 사용자 정보 예시 */}
          {me && (
            <pre className="code">
              {JSON.stringify(me, null, 2)}
            </pre>
          )}
        </div>

      </section>

    )
  }


  return (
    <AuthModal
      open={open}
      onClose={() => setOpen(false)}
      onAuthed={onAuthed}
    />
  )
}

export default AuthPanel