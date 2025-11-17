const mongoose =require('mongoose')


const postSchema = new mongoose.Schema(
    {
        user:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'User',
            required:true
        },
        number :{
            type:Number,
            required:true
        },
        title :{
            type:String,
            required:true,
            trim:true
        },
        content :{
            type:String,
            required:true,
            trim:true
        },
        fileUrl:{
            type:[String],
            trim:true
        },
        status:{
            type:String,
            enum:['pending','approved','rejected'],
            default:'pending',
            index:true
        },
        viewLogs:[
            {
                ip:String,
                userAgent:String,
                timestamp:{
                    type:Date,
                    default:Date.now
                }
            }
        ],
        createdAt:{
            type:Date,
            default:Date.now
        },
        updatedAt:{
            type:Date,
            default:Date.now
        }

    },
    {
        timestamps:true
    }
)
postSchema.index({ user: 1, number: 1 }, { unique: true });

const Post = mongoose.model("Post",postSchema)

module.exports= Post