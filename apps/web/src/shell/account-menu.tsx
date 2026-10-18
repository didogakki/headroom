import { authClient } from "../auth.ts";
import { isDemoSite } from "../lib/site.ts";
import { Avatar, GearIcon, SignOutIcon, UserIcon } from "../icons.tsx";
import { useDevicePrefs } from "../lib/device-prefs.ts";
import { Menu, MenuBlock, MenuItem, MenuSeparator, MenuWho } from "../ui/menu.tsx";
import { Segmented } from "../ui/segmented.tsx";

/**
 * The avatar menu, laid out as Arc's user menu: a header with the face and who is signed in, then groups of rows
 * (appearance; Settings and Account; Sign Out) with hairlines between them. Privacy Mode and Demo Mode live in
 * Settings, on their own tab.
 */
export function AccountMenu(props: {
  readonly name: string;
  readonly onSettings: () => void;
  readonly onAccount: () => void;
}) {
  const prefs = useDevicePrefs();
  return (
    <Menu
      label="账户菜单"
      trigger={<Avatar seed={props.name} />}
      triggerClassName="avatar"
      openOnHover
    >
      <MenuWho lead="已登录为" name={props.name} face={<Avatar seed={props.name} />} />
      <MenuBlock>
        <Segmented
          full
          label="外观"
          value={prefs.appearance}
          onChange={(appearance) => prefs.setAppearance(appearance)}
          options={[
            { value: "system", label: "跟随系统" },
            { value: "light", label: "浅色" },
            { value: "dark", label: "深色" },
          ]}
        />
      </MenuBlock>
      <MenuSeparator />
      <MenuItem icon={<GearIcon />} onSelect={props.onSettings}>
        设置
      </MenuItem>
      {isDemoSite ? null : (
        <>
          <MenuItem icon={<UserIcon />} onSelect={props.onAccount}>
            账户
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<SignOutIcon />} danger onSelect={() => void authClient.signOut()}>
            退出登录
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
