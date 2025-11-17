import React from 'react'
import { NavLink } from 'react-router-dom'
const AdminNav = () => {
  return (
    <nav>
        <NavLink to={'/admin/dashboard'}>대시보드</NavLink>
        <NavLink to={'/admin/posts'}>게시글 관리</NavLink>
        <NavLink to={'/admin/users'}>사용자 관리</NavLink>
    </nav>
  )
}

export default AdminNav