import React, { useState } from "react";

import UploadForm from "./UploadForm";
import "./style/UserDashboard.scss";

import UserPostList from "./UserPostList";
const UserDashboard = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <section>
      <div className="inner">
        <div className="search-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="검색어를 입력해주세요"
          />
          <button className="btn primary" onClick={() => setOpen(true)}>
            업로드
          </button>
        </div>
      </div>
      <div>
        {open && <UploadForm onClose={() => setOpen(false)} />}
        <UserPostList search={search} />
      </div>
    </section>
  );
};

export default UserDashboard;
