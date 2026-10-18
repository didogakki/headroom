import type { OverviewConnection } from "../api.ts";
import { CloseIcon, DotsIcon, PauseIcon, PencilIcon, PlayIcon, UnplugIcon } from "../icons.tsx";
import { Menu, MenuItem } from "../ui/menu.tsx";
import { SplitButton } from "../ui/split-button.tsx";

export interface RowHandlers {
  readonly onPause: (connection: OverviewConnection, paused: boolean) => void;
  readonly onRename: (connection: OverviewConnection) => void;
  readonly onRemove: (connection: OverviewConnection) => void;
}

function reconnectHref(id: string): string {
  return `#/reconnect/${encodeURIComponent(id)}`;
}

/**
 * A disconnected or paused row leads with its contextual action (Reconnect, Resume) as a split button whose
 * menu holds the rest. Other rows keep only the "more" menu. Disconnect and Remove always confirm first.
 */
export function RowActions(props: {
  readonly connection: OverviewConnection;
  readonly name: string;
  readonly busy: boolean;
  readonly handlers: RowHandlers;
}) {
  const { connection, handlers } = props;
  const disconnected = connection.state === "reconnect_required";
  const paused = connection.state === "paused";
  const rename = (
    <MenuItem icon={<PencilIcon />} onSelect={() => handlers.onRename(connection)}>
      重命名
    </MenuItem>
  );
  const remove = (
    <MenuItem danger icon={<CloseIcon />} onSelect={() => handlers.onRemove(connection)}>
      {disconnected ? "移除" : "断开连接"}
    </MenuItem>
  );
  const menuLabel = `${props.name}的更多操作`;
  return (
    <span className="acts">
      {disconnected ? (
        <SplitButton
          variant="primary"
          size="sm"
          href={reconnectHref(connection.id)}
          icon={<UnplugIcon />}
          label="重新连接"
          menuLabel={menuLabel}
        >
          {rename}
          {remove}
        </SplitButton>
      ) : paused ? (
        <SplitButton
          size="sm"
          icon={<PlayIcon />}
          label="恢复"
          busy={props.busy}
          busyLabel="正在恢复"
          onClick={() => handlers.onPause(connection, false)}
          menuLabel={menuLabel}
        >
          <MenuItem
            icon={<UnplugIcon />}
            onSelect={() => {
              window.location.hash = reconnectHref(connection.id);
            }}
          >
            重新连接
          </MenuItem>
          {rename}
          {remove}
        </SplitButton>
      ) : (
        <Menu
          variant="row"
          label={menuLabel}
          trigger={<DotsIcon />}
          triggerClassName="btn quiet sm kebab"
        >
          <MenuItem icon={<PauseIcon />} onSelect={() => handlers.onPause(connection, true)}>
            暂停
          </MenuItem>
          <MenuItem
            icon={<UnplugIcon />}
            onSelect={() => {
              window.location.hash = reconnectHref(connection.id);
            }}
          >
            重新连接
          </MenuItem>
          {rename}
          {remove}
        </Menu>
      )}
    </span>
  );
}
