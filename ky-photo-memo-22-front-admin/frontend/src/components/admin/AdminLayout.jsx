import React from 'react'
import {Outlet} from "react-router-dom"
import AdminNav from './AdminNav'

const AdminLayout = () => {
  return (
    <div>
        <AdminNav/>
        <main>
            <Outlet/>
        </main>
    </div>
  )
}

export default AdminLayout