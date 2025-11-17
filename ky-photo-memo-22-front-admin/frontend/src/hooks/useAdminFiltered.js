import { useMemo } from "react";

export default function useAdminFiltered(
 rawList = [],
 query = {},
 fieldMap = {
  q: "email",
  user: "_id",
  status: "isActive",
 }
) {
 return useMemo(() => {
  const q = (query.q || "").trim().toLowerCase(); // 이메일 검색어
  const user = (query.user || "").replace(/\s+/g, "").toLowerCase(); // ID 검색어
  const status = (query.status || "").trim().toLowerCase(); // "true"/"false"


  return rawList.filter((it)=>{

    const qField= fieldMap.q? it[fieldMap.q]:""
    const emailVal= String(qField?? "").toLowerCase()

    const userField = fieldMap.user? it[fieldMap.user]:""
    let idVal=""

    if(userField !=null){
        if(typeof userField==='string' || typeof userField ==="number"){
            idVal= String(userField).toLowerCase()
        }else if(typeof userField==='object' && userField.toString){
            idVal=userField.toString().toLowerCase()
        }else{
            idVal=String(userField??"").toLowerCase()
        }
    }

    const statusField = fieldMap.status? it[fieldMap.status]:''
    const stVal=
        typeof statusField==='boolean'
        ? String(statusField).toLowerCase()
        : String(statusField??"").toLowerCase()


    const matchEmail = q? emailVal.includes(q):true
    const matchUserId=user? idVal.includes(user):true
    const matchStatus= status? stVal===status:true

    return matchEmail && matchUserId && matchStatus

  })

 }, [rawList, query, fieldMap]);
}
