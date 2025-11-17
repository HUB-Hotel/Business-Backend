import React from "react";
import { formatYMD } from "../../util/formatYMD";
const AdminUserList = ({ items = [] ,onChangeLock,onChangeRole}) => {
 return (
  <ul className="admin-list">
   <li>
    <span>id</span>
    <span>email</span>
    <span>nickname</span>
    <span>role</span>
    <span>status</span>
    <span>date</span>
   </li>
   {items.map((it,i) => (
    <li key={it._id}>
      <span>{i+1}</span>
      <span>{it._id}</span>
      <span>{it.email}</span>
      <span>{it.displayName?? "-"}</span>
      <span>{it.role}</span>
      <span>{it.isActive? "활성":"비활성"}</span>
      <span>{it.createdAt? formatYMD(it.createdAt):""}</span>
      <button className="btn" onClick={()=>onChangeRole(it._id, it.role)}>
        {it.role==='admin'?"관리자 해제":"관리자 지정"}
      </button>
      <button className="btn" onClick={()=>onChangeLock(it._id, it.isActive)}>
        {it.isActive? "활성화":"비활성화"}
      </button>
    </li>
   ))}

   {items.length===0 &&(
    <li>사용자 데이터가 없습니다.</li>
   )}
  </ul>
 );
};

export default AdminUserList;
