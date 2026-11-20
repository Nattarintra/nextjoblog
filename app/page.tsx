import { redirect } from "next/navigation";

import { DEFAULT_POST_LOGIN_PATH } from "@/lib/auth/paths";

export default function Home(): never {
  redirect(DEFAULT_POST_LOGIN_PATH);
}
