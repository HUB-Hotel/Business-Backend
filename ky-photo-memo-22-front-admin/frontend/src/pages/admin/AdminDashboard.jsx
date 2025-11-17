import React ,{useState,useEffect }from 'react'
import { fetchAdminStats } from '../../api/adminApi'
import AdminStats from '../../components/admin/AdminStats'
const AdminDashboard = () => {
  const [stats, setStats]=useState({
    today:0,
    pending:0,
    reports:0
  })

  useEffect(()=>{
    (async()=>{
      try {
        const s = await fetchAdminStats()
        setStats(s)
      } catch (error) {
        console.error('관리자 통계 불러오기 실패',error)
      }
    })()

  },[])

  return <AdminStats {...stats}/>
}

export default AdminDashboard