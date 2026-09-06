"use server";

import { redirect } from "next/navigation";

import { signOut } from "@/server/auth/logout";

/** Çıkış her hâlükârda ana sayfada biter; backend'in cevabı akışı durdurmaz. */
export async function logoutAction() {
  await signOut();
  redirect("/");
}
