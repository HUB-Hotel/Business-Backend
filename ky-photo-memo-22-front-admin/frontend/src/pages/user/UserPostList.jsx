import React, { useEffect, useMemo } from "react";
import UserPostItem from "./UserPostItem";
import { usePosts } from "../../hooks/usePosts";
import "./style/UserPostList.scss";
const UserPostList = ({ search = "" }) => {
  const { items, loading, load } = usePosts();

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(()=>{

    const q = search.trim().toLowerCase()
    if(!q) return items

    return items.filter(
      (i)=>
        i.title?.toLowerCase().includes(q) ||
        i.content?.toLowerCase().includes(q) 
    )

  },[items,search])

  // if (loading) return <p>로딩중...</p>;
  if (!items.length) return <p>게시물이 없습니다.</p>;

  return (
    <div className="post-list">
      {filtered.map((i) => (
        <UserPostItem key={i._id} item={i} />
      ))}
    </div>
  );
};

export default UserPostList;
