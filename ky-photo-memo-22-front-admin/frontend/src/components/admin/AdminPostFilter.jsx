import React from "react";

const AdminPostFilter = ({ value, onChange }) => {
 const set = (patch) => onChange({ ...value, ...patch });
 return (
  <div>
   <input
    type="text"
    placeholder="검색어를 입력하세요"
    value={value.q}
    onChange={(e) =>
     set({
      q: e.target.value,
      page: 1,
     })
    }
   />
    <input
     type="text"
     placeholder="userId (선택)"
     value={value.user}
     onChange={(e) => set({ user: e.target.value.replace(/\s+/g, "") })}
    />

   <select
    value={value.status}
    onChange={(e) =>
     set({
      status: e.target.value,
      page: 1,
     })
    }
   >
    <option value="">전체</option>
    <option value="pending">대기</option>
    <option value="approved">승인</option>
    <option value="rejected">거절</option>
    <option value="hidden">숨김</option>
   </select>
  </div>
 );
};

export default AdminPostFilter;
