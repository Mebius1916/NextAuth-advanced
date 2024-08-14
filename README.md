# 新页面

### NextAuth-advanced项目随笔

#### 前言

一个很好的教程，此教程与前面nextjs14、mongoose教程衔接，通过一个小demo来巩固mongoose、next、next-auth的使用，正巧nextjs14教程中使用的next-auth让我云里雾里，这个教程简直是雪中送炭。

#### **目录讲解**

![dfe42bdf3418b471ef97be31d812c515_oonFswMOAU](https://github.com/user-attachments/assets/090671ec-ce36-4acc-b8a2-92a6cb066f5d)


#### **随笔**

**为什么用cache存储session？**

```javascript
import { auth } from "@/auth";
import { cache } from "react";

export const getSession = cache(async () => {
  const session = await auth();
  return session;
});

```

维护session，提高性能。

- session调用频繁，使用cache能减少负载，提高响应速度。
- cache读取速度快，性能好。
- session易丢失，使用cache能有效缓存会话数据。

**html表格标签**

- `<tr>`表示表格的一行。
- `<td>`表示表格的数据单元格。
- &#x20;`<th>`表示表格的表头单元格。
- `<table>`作为最外层的容器，包含`<thead>`和`<tbody>`。
- `<thead>`通常位于`<table>`的顶部，包含`<tr>`元素。`<tr>`中的`<th>`元素表示列标题。
- `<tbody>`位于`<thead>`之后，包含`<tr>`元素。`<tr>`中的`<td>`元素表示行数据。

![fd8fbb2b31b3cb6566b6cff801380cff_tGJKXAOJBm](https://github.com/user-attachments/assets/248a44aa-2246-4669-ac3c-f9f0c1579a08)


**mongoose数据库使用**

\*\*`.env`\*\***环境配置**

```javascript
MONGO_URI='mongodb://127.0.0.1:27017/nextAuth'
AUTH_SECRET=klsgjcsr6ku987123kjdvlksadfadf0243
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

\*\*`/models/User.ts`\*\***导出User模型**

```javascript
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, select: false },
  role: { type: String, default: "user" },
  image: { type: String },
  authProviderId: { type: String },
});

export const User = mongoose.models?.User || mongoose.model("User", userSchema);

```

**`/lib/db.ts`抽离连接数据库**函数⇒自定义hook

```javascript
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log(`Successfully connected to mongoDB 🥂`);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;

```

`/action/user.ts`使用数据库

```javascript
"use server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
const login = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  try {
    await signIn("credentials", {
      redirect: false,
      callbackUrl: "/",
      email,
      password,
    });
  } catch (error) {
    const someError = error as CredentialsSignin;
    return someError.cause;
  }
  redirect("/");
};
const register = async (formData: FormData) => {
  const firstName = formData.get("firstname") as string;
  const lastName = formData.get("lastname") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!firstName || !lastName || !email || !password) {
    throw new Error("Please fill all fields");
  }
   await connectDB(); 
  // existing user
   const existingUser = await User.findOne({ email }); 
  if (existingUser) throw new Error("User already exists");
  const hashedPassword = await hash(password, 12);
   await User.create({ firstName, lastName, email, password: hashedPassword }); 
  console.log(`User created successfully 🥂`);
  redirect("/login");
};
const fetchAllUsers = async () => {
   await connectDB(); 
   const users = await User.find({}); 
  return users;
};
export { register, login, fetchAllUsers };
```

`auth.ts`在next-auth配置中使用数据库

```javascript
// 创建 NextAuth 配置对象
export const { handlers, signIn, signOut, auth } = NextAuth({
  // 配置使用的认证提供者列表
  providers: [
    // 配置 Github 认证提供者，使用环境变量中的客户端 ID 和客户端密钥
    Github({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    // 配置 Google 认证提供者，使用环境变量中的客户端 ID 和客户端密钥
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    // 凭证
    Credentials({
      name: "Credentials",
      // 定义登录表单的字段
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // 通过凭证信息来授权
      authorize: async (credentials) => {
        // 提取用户提供的邮箱和密码
        const email = credentials.email as string | undefined;
        const password = credentials.password as string | undefined;
        // 如果邮箱或密码为空，抛出错误
        if (!email ||!password) {
          throw new CredentialsSignin("Please provide both email & password");
        }
        // 连接数据库
         await connectDB(); 
        // 在数据库中查找具有给定邮箱的用户，并包含密码和角色字段
         const user = await User.findOne({ email }).select("+password +role"); 
        // 如果没有找到用户，抛出错误
        if (!user) {
          throw new Error("Invalid email or password");
        }
        // 如果用户存在但没有设置密码（可能使用了第三方登录），抛出错误
        if (!user.password) {
          throw new Error("Invalid email or password");
        }
        // 比较用户提供的密码和数据库中存储的密码哈希值是否匹配
        const isMatched = await compare(password, user.password);
        // 如果密码不匹配，抛出错误
        if (!isMatched) {
          throw new Error("Password did not matched");
        }
        // 密码匹配成功，返回用户数据用于构建会话
        const userData = {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          id: user._id,
        };

        return userData;
      },
    }),
  ],
  // 配置登录页面的 URL
  pages: {
    signIn: "/login",
  },
  // 定义在验证过程中将会话和令牌进行处理的回调函数
  callbacks: {
    // 登录后更新缓存
    async session({ session, token }) {
      if (token?.sub && token?.role) {
        session.user.id = token.sub;
        //@ts-ignore
        session.user.role = token.role;
      }
      return session;
    },
    // 更新 JWT 令牌对象
    async jwt({ token, user }) {
      if (user) {
        //@ts-ignore
        token.role = user.role;
      }
      return token;
    },
    // 处理登录成功后的回调函数
    signIn: async ({ user, account }) => {
      if (account?.provider === "google") {
        try {
          // 从登录用户信息中提取必要属性
          const { email, name, image, id } = user;
          // 连接数据库
           await connectDB(); 
          // 查询数据库中是否已经存在具有给定邮箱的用户
           const alreadyUser = await User.findOne({ email });
 
          // 如果不存在，则创建新用户
          if (!alreadyUser) {
             await User.create({ email, name, image, authProviderId: id }); 
          } else {
            // 如果用户已经存在，直接返回 true 表示登录成功
            return true;
          }
        } catch (error) {
          // 如果在处理过程中发生任何错误，抛出错误信息
          throw new Error("Error while creating user");
        }
      }
      // 如果是通过用户名和密码登录，则直接返回 true 表示登录成功
      if (account?.provider === "credentials") {
        return true;
      } else {
        // 其他情况返回 false，表示登录失败
        return false;
      }
    },
  },
});
```
