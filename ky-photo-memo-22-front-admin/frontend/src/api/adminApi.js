import api from './client'


/** 대시보드 지표 */
export const fetchAdminStats = async () => {
  const { data} = await api.get("/api/admin/stats");
  console.log(data)
  return data; // { today, pending, reports }
};


/** 게시글 목록 (필터/페이지) */
export const fetchAdminPosts = async () => {
  const { data } = await api.get("/api/admin/posts"); // 파라미터 없음
  return Array.isArray(data) ? data : data.items ?? [];
};
export const fetchAdminUsers = async (params = {}) => {
  const { page = 1, size = 20, status, q } = params;
  const { data } = await api.get("/api/admin/users", {
    params: { page, size, status, q },
  });
    // data 구조: { total, page, size, totalPages, users }
  return {
    items: Array.isArray(data?.users) ? data.users : [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    size: data?.size ?? size,
    totalPages: data?.totalPages ?? 1,
  };
};


/** 게시글 수정 (승인/거절/숨김 등) */
export const patchAdminPost = async (id, patch) => {
  const { data } = await api.patch(`/api/admin/posts/${id}`, patch);
  return data;
};



/** 사용자 업데이트 (권한/활성/잠금해제) */
export const patchAdminUser = async (id, patch) => {
  const { data } = await api.patch(`/api/admin/users/${id}`, patch);
  return data;
};


