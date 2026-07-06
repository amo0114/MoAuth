import assert from "node:assert/strict";
import test from "node:test";

const ACCOUNT_NAV_GROUPS = [
  {
    label: "个人中心",
    requiredRole: "user",
    items: [
      { title: "总览", href: "/account/overview", hideForAdmin: false },
      { title: "申请接入", href: "/account/developer", hideForAdmin: true },
    ],
  },
  {
    label: "管理后台",
    requiredRole: "admin",
    items: [{ title: "应用管理", href: "/admin/applications", hideForAdmin: false }],
  },
];

function filterNavGroups({ showAdmin, isAdmin }) {
  return ACCOUNT_NAV_GROUPS.filter((group) => {
    if (group.requiredRole === "admin") return showAdmin;
    return true;
  }).map((group) => ({
    ...group,
    items: group.items.filter((link) => !(link.hideForAdmin && isAdmin)),
  }));
}

test("admin users do not see developer apply link", () => {
  const groups = filterNavGroups({ showAdmin: true, isAdmin: true });
  const userItems = groups.find((group) => group.label === "个人中心")?.items || [];
  const hrefs = userItems.map((item) => item.href);
  assert.ok(!hrefs.includes("/account/developer"));
  assert.ok(hrefs.includes("/account/overview"));
});

test("regular users see developer apply but not admin console", () => {
  const groups = filterNavGroups({ showAdmin: false, isAdmin: false });
  const userItems = groups.find((group) => group.label === "个人中心")?.items || [];
  const hrefs = userItems.map((item) => item.href);
  assert.ok(hrefs.includes("/account/developer"));
  assert.equal(groups.some((group) => group.label === "管理后台"), false);
});