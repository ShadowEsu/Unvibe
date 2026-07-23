import { redirect } from "next/navigation";

/** Legacy path — keep working bookmarks, stay undiscoverable. */
export default function WaitlistAdminRedirect() {
  redirect("/waitlist");
}
