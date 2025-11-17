export function formatYMD(value){


    if(!value) return "";
    const d = new Date(value)
    if(isNaN(d)) return ""
    const tz = d.getTimezoneOffset()*60000
    const local = new Date(d.getTime()-tz)

    return local.toISOString().slice(0,10)
}