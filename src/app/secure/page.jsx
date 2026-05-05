import { redirect } from "next/navigation"

export default function SecureIndexPage() {
  redirect("/secure/home")
}
