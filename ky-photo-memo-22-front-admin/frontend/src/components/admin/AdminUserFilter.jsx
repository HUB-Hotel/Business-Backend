import React from "react";

const AdminUserFilter = ({
 filterValue,
 onFilterChange,
 meta = {
  total: 0,
  page: 1,
  size: 20,
  totalPage: 1,
 },
}) => {


 const set = (patch) => onFilterChange({ ...filterValue, ...patch });

 return (
  <div className="admin-filter">
   <input
    type="text"
    placeholder="email"
    value={filterValue.q}
    onChange={(e) => set({ q: e.target.value })}
   />
   <input type="text" placeholder="id검색"
   value={filterValue.user}
onChange={(e) => set({ user: e.target.value.replace(/\s+/g, "") })}
   />

   <select 
   onChange={(e)=>set({status:e.target.value})}
   value={filterValue.status}>
    <option value="">전체</option>
    <option value="true">활성</option>
    <option value="false">비활성</option>
   </select>
  </div>
 );
};

export default AdminUserFilter;
