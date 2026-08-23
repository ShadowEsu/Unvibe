import { redirect } from "next/navigation";

/** Legacy path. Keep working bookmarks, stay undiscoverable. */
export default function WaitlistAdminRedirect() {
  redirect("/waitlist");
}
