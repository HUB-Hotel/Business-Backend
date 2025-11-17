import React from "react";
import { formatYMD } from "../../util/formatYMD";
const AdminPostsList = ({ items = [], onApprove, onReject }) => {
 return (
  <div className="inner">
   <ul className="admin-list">
    <li>
     <span></span>
     <span>제목</span>
     <span>작성자</span>
     <span>상태</span>
     <span>업데이트</span>
     <span>액션</span>
    </li>
    {items.map((it, i) => (
     <li key={it._id}>
      <span className="num">{i + 1}</span>
      <span className="title">{it.title}</span>
      <span className="user">{it._userId}</span>
      <span className="status">{it.status}</span>
      <span className="date">
       {it.updatedAt ? formatYMD(it.updatedAt) : "-"}
      </span>
      <span className="actions">
       {it.status !== "approved" && (
        <button onClick={() => onApprove(it._id)} className="btn secondary">
         승인
        </button>
       )}
       {it.status !== "rejected" && (
        <button onClick={() => onReject(it._id)} className="btn danger">
         거절
        </button>
       )}
      </span>
     </li>
    ))}
   </ul>
  </div>
 );
};

export default AdminPostsList;
