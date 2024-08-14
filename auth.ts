// 导入 NextAuth 模块，用于创建登录、登出等认证功能
import NextAuth, { CredentialsSignin } from "next-auth";
// 导入 Credentials 模块，用于配置基于用户名和密码的认证方式
import Credentials from "next-auth/providers/credentials";
// 导入 Github 模块，用于配置 Github 认证方式
import Github from "next-auth/providers/github";
// 导入 Google 模块，用于配置 Google 认证方式
import Google from "next-auth/providers/google";
// 导入连接数据库的模块
import connectDB from "./lib/db";
// 导入用户模型，用于查询和操作数据库中的用户信息
import { User } from "./models/User";
// 导入 bcryptjs 模块，用于比较密码哈希值
import { compare } from "bcryptjs";

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
