import { useState, type CSSProperties } from "react";
import type { Account, View } from "../shared/types";
import type { PlayerProfile, ProfileGift } from "../shared/profile";
import { profileCombinations, giftCompensation } from "../shared/profile";
import { cosmeticItem, cosmeticRarities } from "../shared/cosmetics";
import { isDealing } from "../shared/dealing";
import { CosmeticPreview } from "./CosmeticPreview";
import { ProfileOverview, CombinationTable } from "./ProfileOverview";
const format = (n: number) => n.toLocaleString("ru-RU");
const giftNames = {
  rare: "Редкий подарок",
  epic: "Эпический подарок",
  exclusive: "Эксклюзивный подарок",
};
export function ProfilePanel({
  account,
  profile,
  activeRoom,
  busy,
  error,
  onBack,
  onInventory,
  onOpen,
}: {
  account: Account;
  profile: PlayerProfile;
  activeRoom?: View;
  busy: boolean;
  error: string;
  onBack: () => void;
  onInventory: () => void;
  onOpen: (id: string) => Promise<ProfileGift | null>;
}) {
  const [tab, setTab] = useState<"stats" | "gifts">("stats"),
    [opened, setOpened] = useState<ProfileGift | null>(null);
  const duringHand =
    activeRoom &&
    (!["waiting", "showdown"].includes(activeRoom.phase) ||
      isDealing(activeRoom, Date.now()));
  const rewardItem = cosmeticItem(opened?.itemId);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ЛИЧНОЕ ДЕЛО КЛУБА</div>
          <h1>Мой профиль</h1>
          <p>Ваши раздачи, комбинации и коллекция.</p>
        </div>
        <button onClick={onBack}>← К столам</button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <ProfileOverview
        account={account}
        profile={profile}
        onInventory={onInventory}
      />
      <div
        className="inventory-tabs"
        role="tablist"
        aria-label="Разделы профиля"
      >
        <button
          role="tab"
          id="profile-stats-tab"
          aria-controls="profile-content"
          aria-selected={tab === "stats"}
          onClick={() => setTab("stats")}
        >
          ♠ Комбинации
        </button>
        <button
          role="tab"
          id="profile-gifts-tab"
          aria-controls="profile-content"
          aria-selected={tab === "gifts"}
          onClick={() => setTab("gifts")}
        >
          ♢ Подарки{" "}
          {profile.gifts.length > 0 && (
            <span className="profile-tab-count">{profile.gifts.length}</span>
          )}
        </button>
      </div>
      <div
        id="profile-content"
        role="tabpanel"
        aria-labelledby={
          tab === "stats" ? "profile-stats-tab" : "profile-gifts-tab"
        }
      >
        {tab === "stats" ? (
          <CombinationTable combinations={profile.combinations} />
        ) : (
          <>
            <section className="club-panel gift-rules">
              <div>
                <div className="eyebrow">ЗА КРАСИВУЮ ПОБЕДУ</div>
                <h2>Как получить подарок</h2>
                <p>
                  Победите на вскрытии с одной из этих комбинаций. При
                  разделённом банке подарок получит каждый подходящий
                  победитель, один за раздачу.
                </p>
              </div>
              <div className="gift-rule-grid">
                {(["rare", "epic", "exclusive"] as const).map((rarity) => (
                  <div
                    key={rarity}
                    style={
                      {
                        "--rarity-color": cosmeticRarities[rarity].color,
                      } as CSSProperties
                    }
                  >
                    <span className="gift-rule-mark">♢</span>
                    <strong>{giftNames[rarity]}</strong>
                    <p>
                      {profileCombinations
                        .filter((c) => c.rarity === rarity)
                        .map((c) => c.name)
                        .join(" · ")}
                    </p>
                    <small>
                      Полный набор → {format(giftCompensation[rarity])} фишек
                    </small>
                  </div>
                ))}
              </div>
              <p className="gift-rule-note">
                Внутри — случайный аксессуар указанной редкости, которого у вас
                ещё нет. Если все аксессуары этой редкости уже собраны, фишки
                начисляются сразу вместо подарка. Если набор заполнится до
                открытия старого подарка, он также принесёт фишки.
              </p>
            </section>
            {opened && (
              <section
                className="club-panel gift-opening"
                role="status"
                key={opened.id}
                style={
                  {
                    "--rarity-color": cosmeticRarities[opened.rarity].color,
                  } as CSSProperties
                }
              >
                <div className="gift-opening-art">
                  <CosmeticPreview item={rewardItem ?? null} />
                </div>
                <div>
                  <div className="eyebrow">ПОДАРОК ОТКРЫТ</div>
                  <h2>
                    {rewardItem?.name ??
                      `+${format(opened.compensation)} фишек`}
                  </h2>
                  <p>
                    {rewardItem
                      ? `${cosmeticRarities[opened.rarity].name} · Аксессуар добавлен в инвентарь.`
                      : "Все аксессуары этой редкости уже у вас. Фишки добавлены на баланс."}
                  </p>
                  {rewardItem && (
                    <button onClick={onInventory}>Выбрать в инвентаре ↗</button>
                  )}
                </div>
                <button
                  className="gift-result-close"
                  aria-label="Закрыть результат подарка"
                  onClick={() => setOpened(null)}
                >
                  ×
                </button>
              </section>
            )}
            <section className="profile-pending">
              <h2>
                Ваши подарки <span>{profile.gifts.length}</span>
              </h2>
              {duringHand && profile.gifts.length > 0 && (
                <p>
                  Открывать подарки можно между раздачами. Вернитесь к столу,
                  чтобы не пропустить ход.
                </p>
              )}
              {profile.gifts.length === 0 ? (
                <div className="club-panel profile-empty">
                  <span aria-hidden="true">♢</span>
                  <h3>Все подарки открыты</h3>
                  <p>
                    Новые будут ждать здесь после побед с нужной комбинацией.
                  </p>
                </div>
              ) : (
                <div className="gift-grid">
                  {profile.gifts.map((g) => (
                    <article
                      key={g.id}
                      className="club-panel gift-card"
                      style={
                        {
                          "--rarity-color": cosmeticRarities[g.rarity].color,
                        } as CSSProperties
                      }
                    >
                      <div className="gift-box-art" aria-hidden="true">
                        <i />
                        <b />
                      </div>
                      <h3>{giftNames[g.rarity]}</h3>
                      <p>
                        За комбинацию «
                        {
                          profileCombinations.find(
                            (c) => c.id === g.combination,
                          )?.name
                        }
                        »
                      </p>
                      <small>
                        {new Date(g.createdAt).toLocaleDateString("ru-RU")}
                      </small>
                      <button
                        className="primary"
                        disabled={busy || !!duringHand}
                        onClick={async () => {
                          const result = await onOpen(g.id);
                          if (result) setOpened(result);
                        }}
                        aria-label={`Открыть: ${giftNames[g.rarity]}`}
                      >
                        Открыть подарок
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
            {profile.recentRewards.length > 0 && (
              <section className="club-panel reward-history">
                <h2>Недавние награды</h2>
                {profile.recentRewards.map((g) => (
                  <div key={g.id}>
                    <span>
                      {cosmeticItem(g.itemId)?.name ??
                        `+${format(g.compensation)} фишек`}
                    </span>
                    <small>
                      {
                        profileCombinations.find((c) => c.id === g.combination)
                          ?.name
                      }
                    </small>
                    <time>
                      {new Date(g.openedAt!).toLocaleDateString("ru-RU")}
                    </time>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
