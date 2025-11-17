import React from 'react'

const AdminStats = ({    today, pending, reports}) => {
  return (
    <div className='inner'>
      <div className="stat-card">
        <h3>오늘 생성 : <strong>{today}</strong></h3>
      </div>
      <div className="stat-card">
        <h3>승인 대기 : <strong>{pending}</strong></h3>
      </div>
      <div className="stat-card">
        <h3>신고 합계 : <strong>{reports}</strong></h3>
      </div>
      </div>
  )
}

export default AdminStats