import { Outlet } from "react-router-dom";

// The People pages share this route. Its parts are reached from the People entry in the dashboard menu (hover or tap it for Contacts, Leads,
// Pipeline and Settings), so nothing sits above the page.
export default function PeopleLayout() {
  return <Outlet />;
}
