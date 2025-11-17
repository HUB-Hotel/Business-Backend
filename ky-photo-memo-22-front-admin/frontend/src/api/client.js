import axios from "axios"


const BASE_URL = import.meta.env.VITE_API_URL

const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true
})


api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token')
        if (token) config.headers.Authorization = `Bearer ${token}`
        else delete config.headers.Authorization

        return config
    }
  
)

api.interceptors.response.use(
    (res)=>res,
    (err)=>{
        const code =err?.response?.status

        if(code==401 || code==403){
            localStorage.removeItem('token')
            localStorage.removeItem('user')
        }
        return Promise.reject(err)
    }
)

export function getErrorMessage(error, fallback='요청 실패'){
    return error.response?.data?.message || error.message || fallback
}

export async function register({email, password, displayname}){

    const {data}=await api.post('/api/auth/register',{
        email,
        password,
        displayname
    })

    return data

}
export async function login({email, password}){

    const {data}=await api.post('/api/auth/login',{
        email,
        password,
    })
    return data

}
export async function fetchMe(){
    const {data}=await api.get('/api/auth/me')

    return data
}

export async function logout(){
    return await api.post('/api/auth/logout')
}


export function saveAuthToStorage({user,token}){

    if(user) localStorage.setItem('user',JSON.stringify(user))
    if(token) localStorage.setItem('token',token)

}

export function clearAuthStorage(){
    localStorage.removeItem('user')
    localStorage.removeItem('token')
}



export default api