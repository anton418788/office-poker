import type { CSSProperties, ReactNode } from "react";
import { AvatarContent } from "./AvatarContent";
import type { Account } from "../shared/types";
import type { PublicPlayerProfile } from "../shared/profile";
import { profileCombinations } from "../shared/profile";
import { cosmeticRarities } from "../shared/cosmetics";
const format = (n: number) => n.toLocaleString("ru-RU");
export function ProfileOverview({
  account,
  profile,
  onInventory,
  portrait,
}: {
  account: Pick<Account, "name" | "balance" | "admin"> & {
    login?: string | null;
    avatarUrl?: string | null;
  };
  profile: Pick<
    PublicPlayerProfile,
    "hands" | "wins" | "showdowns" | "collection"
  >;
  onInventory?: () => void;
  portrait?: ReactNode;
}) {
  return (
    <>
      <section className="profile-hero club-panel">
        {portrait ?? (
          <span className="profile-portrait" aria-hidden="true">
            <AvatarContent name={account.name} url={account.avatarUrl} />
          </span>
        )}
        <div>
          <h2>{account.name}</h2>
          <p>
            {account.login && <>@{account.login} · </>}
            {account.admin ? "Администратор клуба" : "Участник клуба"}
          </p>
        </div>
        <strong className="profile-wallet">
          ◉ {format(account.balance)}
          <small>Баланс фишек</small>
        </strong>
      </section>
      <div className="profile-metrics">
        {[
          ["Сыграно раздач", profile.hands],
          ["Побед", profile.wins],
          ["До вскрытия", profile.showdowns],
          [
            "Предметов",
            Object.values(profile.collection).reduce((a, b) => a + b, 0),
          ],
        ].map(([label, value]) => (
          <div key={label} className="club-panel">
            <strong>{format(Number(value))}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <section className="profile-collection club-panel">
        <div>
          <h2>Коллекция</h2>
          <p>Сидушки, рубашки и аксессуары</p>
        </div>
        <div className="profile-rarities">
          {Object.entries(cosmeticRarities).map(([rarity, definition]) => (
            <span
              key={rarity}
              style={{ "--rarity-color": definition.color } as CSSProperties}
            >
              <i />
              {definition.name}
              <strong>
                {profile.collection[rarity as keyof typeof cosmeticRarities]}
              </strong>
            </span>
          ))}
        </div>
        {onInventory && <button onClick={onInventory}>В инвентарь ↗</button>}
      </section>
    </>
  );
}
export function CombinationTable({
  combinations,
}: {
  combinations: PublicPlayerProfile["combinations"];
}) {
  return (
    <section className="club-panel profile-combinations">
      <h2>Собранные комбинации</h2>
      <p>
        Учитывается одна сильнейшая комбинация на вскрытии — даже если банк
        достался сопернику. Фолд и победа без вскрытия не добавляют комбинацию.
        Статистика ведётся с момента этого обновления.
      </p>
      <table>
        <thead>
          <tr>
            <th>Комбинация</th>
            <th>Собрано раз</th>
          </tr>
        </thead>
        <tbody>
          {profileCombinations.map((c) => {
            const count = combinations[c.id] ?? 0;
            return (
              <tr
                key={c.id}
                className={count ? "combination-earned" : "combination-unseen"}
              >
                <td>
                  <span aria-hidden="true">{count ? "♠" : "◇"}</span>
                  {c.name}
                </td>
                <td>{format(count)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
