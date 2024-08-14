//维护session，提高性能。
//session调用频繁，使用cache能减少负载，提高响应速度。
//cache读取速度快，性能好。
//session易丢失，使用cache能有效缓存会话数据。
import { auth } from "@/auth";
import { cache } from "react";

export const getSession = cache(async () => {
  const session = await auth();
  return session;
});
