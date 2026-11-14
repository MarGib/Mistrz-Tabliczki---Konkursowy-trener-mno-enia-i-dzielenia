import { useState } from 'react';
import astroPenguinImg from '../assets/images/avatar_astro_penguin_1794659078223.jpg';
import braveLionImg from '../assets/images/avatar_brave_lion_1794659079310.jpg';
import cleverFoxImg from '../assets/images/avatar_clever_fox_1794659060923.jpg';
import cosmicCatImg from '../assets/images/avatar_cosmic_cat_1794659061071.jpg';
import emeraldDragonImg from '../assets/images/avatar_emerald_dragon_1794659076600.jpg';
import mathPandaImg from '../assets/images/avatar_math_panda_1794659061531.jpg';
import starUnicornImg from '../assets/images/avatar_star_unicorn_1794659077441.jpg';
import turboRobotImg from '../assets/images/avatar_turbo_robot_1794659062013.jpg';
import owlMascotImg from '../assets/images/mascot_math_owl_1794652991130.jpg';
import { findPresetAvatar } from '../data/avatars';
import type { AvatarCharacter, AvatarSpec } from '../types/math';

const ILLUSTRATED_MASCOT_MAP: Record<string, string> = {
  owl: owlMascotImg,
  'owl-classic': owlMascotImg,
  'mascot-fox': cleverFoxImg,
  'mascot-cat': cosmicCatImg,
  'mascot-panda': mathPandaImg,
  'mascot-robot': turboRobotImg,
  'mascot-dragon': emeraldDragonImg,
  'mascot-unicorn': starUnicornImg,
  'mascot-lion': braveLionImg,
  'mascot-penguin': astroPenguinImg,
};

interface AvatarDisplayProps {
  avatarId: string;
  customSpec?: AvatarSpec;
  name?: string;
  sizeClass?: string;
  overrideSpec?: AvatarSpec;
}

const DEFAULT_FALLBACK_SPEC: AvatarSpec = {
  character: 'owl',
  bgColor: '#D1FAE5',
  bodyColor: '#059669',
  accessory: 'glasses',
  prop: 'star',
};

function CharacterEarsOrTop({ character, bodyColor }: { character: AvatarCharacter; bodyColor: string }) {
  switch (character) {
    case 'owl':
      return (
        <>
          <polygon points="24,30 34,18 39,30" fill="#F59E0B" />
          <polygon points="76,30 66,18 61,30" fill="#F59E0B" />
        </>
      );
    case 'fox':
    case 'cat':
      return (
        <>
          <polygon points="22,36 28,14 42,28" fill={bodyColor} />
          <polygon points="78,36 72,14 58,28" fill={bodyColor} />
          <polygon points="26,33 30,20 38,28" fill="#FDE68A" />
          <polygon points="74,33 70,20 62,28" fill="#FDE68A" />
        </>
      );
    case 'rabbit':
      return (
        <>
          <ellipse cx="37" cy="20" rx="6" ry="15" fill={bodyColor} />
          <ellipse cx="63" cy="20" rx="6" ry="15" fill={bodyColor} />
          <ellipse cx="37" cy="20" rx="3" ry="10" fill="#FBCFE8" />
          <ellipse cx="63" cy="20" rx="3" ry="10" fill="#FBCFE8" />
        </>
      );
    case 'bear':
    case 'panda':
      return (
        <>
          <circle cx="28" cy="28" r="10" fill={character === 'panda' ? '#1E293B' : bodyColor} />
          <circle cx="72" cy="28" r="10" fill={character === 'panda' ? '#1E293B' : bodyColor} />
          <circle cx="28" cy="28" r="5" fill="#FDE68A" />
          <circle cx="72" cy="28" r="5" fill="#FDE68A" />
        </>
      );
    case 'dog':
      return (
        <>
          <ellipse cx="22" cy="48" rx="8" ry="16" fill={bodyColor} transform="rotate(-12 22 48)" />
          <ellipse cx="78" cy="48" rx="8" ry="16" fill={bodyColor} transform="rotate(12 78 48)" />
        </>
      );
    case 'lion':
      return (
        <circle cx="50" cy="52" r="32" fill="#D97706" />
      );
    case 'dragon':
      return (
        <>
          <polygon points="30,28 24,12 38,24" fill="#F59E0B" />
          <polygon points="70,28 76,12 62,24" fill="#F59E0B" />
          <polygon points="46,24 50,11 54,24" fill="#F59E0B" />
        </>
      );
    case 'unicorn':
      return (
        <>
          <polygon points="50,7 44,28 56,28" fill="#FACC15" />
          <ellipse cx="34" cy="28" rx="5" ry="9" fill={bodyColor} />
          <ellipse cx="66" cy="28" rx="5" ry="9" fill={bodyColor} />
        </>
      );
    case 'frog':
      return (
        <>
          <circle cx="34" cy="30" r="10" fill={bodyColor} />
          <circle cx="66" cy="30" r="10" fill={bodyColor} />
        </>
      );
    case 'robot':
      return (
        <>
          <line x1="50" y1="26" x2="50" y2="12" stroke="#64748B" strokeWidth="3" />
          <circle cx="50" cy="11" r="4.5" fill="#FACC15" />
        </>
      );
    case 'alien':
      return (
        <>
          <line x1="38" y1="28" x2="32" y2="14" stroke={bodyColor} strokeWidth="3" />
          <line x1="62" y1="28" x2="68" y2="14" stroke={bodyColor} strokeWidth="3" />
          <circle cx="32" cy="13" r="4" fill="#FACC15" />
          <circle cx="68" cy="13" r="4" fill="#FACC15" />
        </>
      );
    case 'wizard':
      return (
        <>
          <polygon points="50,6 28,32 72,32" fill="#4338CA" />
          <ellipse cx="50" cy="32" rx="28" ry="5" fill="#312E81" />
          <polygon points="50,14 52,19 57,19 53,22 54,27 50,24 46,27 47,22 43,19 48,19" fill="#FACC15" />
        </>
      );
    case 'knight':
      return (
        <path d="M26,40 C26,20 74,20 74,40 L74,56 L26,56 Z" fill="#94A3B8" />
      );
    case 'astronaut':
      return (
        <circle cx="50" cy="50" r="32" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2.5" />
      );
    default:
      return null;
  }
}

export function AvatarSvg({ spec, className = 'w-full h-full' }: { spec: AvatarSpec; className?: string }) {
  const { character, bgColor, bodyColor, accessory, prop } = spec;

  const isRocket = character === 'rocket';
  const isRobot = character === 'robot';
  const isPanda = character === 'panda';

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect width="100" height="100" rx="22" fill={bgColor} />
      <circle cx="50" cy="88" r="28" fill="rgba(255,255,255,0.22)" />

      {isRocket ? (
        <g>
          <polygon points="36,70 24,84 40,78" fill="#F59E0B" />
          <polygon points="64,70 76,84 60,78" fill="#F59E0B" />
          <path d="M50,14 C65,30 68,54 62,74 L38,74 C32,54 35,30 50,14 Z" fill={bodyColor} />
          <circle cx="50" cy="44" r="10" fill="#E0F2FE" stroke="#FFFFFF" strokeWidth="3" />
          <polygon points="44,74 56,74 50,90" fill="#FACC15" />
        </g>
      ) : (
        <g>
          <CharacterEarsOrTop character={character} bodyColor={bodyColor} />

          {/* Head */}
          {isRobot ? (
            <rect x="24" y="26" width="52" height="48" rx="14" fill={bodyColor} />
          ) : (
            <circle
              cx="50"
              cy="52"
              r="26"
              fill={isPanda ? '#FFFFFF' : bodyColor}
              stroke={isPanda ? '#1E293B' : 'none'}
              strokeWidth={isPanda ? '2' : '0'}
            />
          )}

          {/* Face mask / belly details */}
          {character === 'astronaut' && (
            <rect x="30" y="34" width="40" height="28" rx="12" fill="#0F172A" />
          )}
          {character === 'owl' && (
            <>
              <circle cx="40" cy="48" r="10" fill="#FFFFFF" />
              <circle cx="60" cy="48" r="10" fill="#FFFFFF" />
              <polygon points="46,54 54,54 50,62" fill="#F59E0B" />
            </>
          )}
          {character === 'penguin' && (
            <>
              <ellipse cx="50" cy="56" rx="18" ry="18" fill="#FFFFFF" />
              <polygon points="45,53 55,53 50,60" fill="#F59E0B" />
            </>
          )}
          {isPanda && (
            <>
              <ellipse cx="39" cy="48" rx="7" ry="8" fill="#1E293B" />
              <ellipse cx="61" cy="48" rx="7" ry="8" fill="#1E293B" />
            </>
          )}
          {(character === 'fox' || character === 'cat' || character === 'dog' || character === 'bear' || character === 'lion') && (
            <ellipse cx="50" cy="60" rx="13" ry="10" fill="#FEF3C7" />
          )}

          {/* Eyes */}
          <circle cx="40" cy="48" r="4" fill={character === 'astronaut' ? '#38BDF8' : '#0F172A'} />
          <circle cx="60" cy="48" r="4" fill={character === 'astronaut' ? '#38BDF8' : '#0F172A'} />
          <circle cx="41.5" cy="46.5" r="1.4" fill="#FFFFFF" />
          <circle cx="61.5" cy="46.5" r="1.4" fill="#FFFFFF" />

          {/* Smile / Nose */}
          {character !== 'owl' && character !== 'penguin' && character !== 'astronaut' && (
            <>
              <circle cx="50" cy="56" r="2.6" fill="#0F172A" />
              <path
                d="M44,61 Q50,66 56,61"
                fill="none"
                stroke="#0F172A"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Accessories */}
          {accessory === 'glasses' && (
            <g stroke="#0F172A" strokeWidth="2.5" fill="rgba(255,255,255,0.2)">
              <circle cx="40" cy="48" r="8" />
              <circle cx="60" cy="48" r="8" />
              <line x1="48" y1="48" x2="52" y2="48" />
            </g>
          )}
          {accessory === 'crown' && (
            <polygon
              points="34,27 38,14 45,22 50,12 55,22 62,14 66,27"
              fill="#FACC15"
              stroke="#B45309"
              strokeWidth="1.5"
            />
          )}
          {accessory === 'headphones' && (
            <g>
              <path d="M23,50 A27,27 0 0,1 77,50" fill="none" stroke="#1E293B" strokeWidth="4" />
              <rect x="18" y="42" width="7" height="16" rx="3.5" fill="#FACC15" stroke="#1E293B" strokeWidth="1.5" />
              <rect x="75" y="42" width="7" height="16" rx="3.5" fill="#FACC15" stroke="#1E293B" strokeWidth="1.5" />
            </g>
          )}
          {accessory === 'cap' && (
            <g>
              <path d="M27,36 C30,22 70,22 73,36 Z" fill="#1E293B" />
              <rect x="46" y="31" width="32" height="5" rx="2.5" fill="#FACC15" />
            </g>
          )}
          {accessory === 'halo' && (
            <ellipse
              cx="50"
              cy="17"
              rx="16"
              ry="4.5"
              fill="none"
              stroke="#FACC15"
              strokeWidth="3"
            />
          )}
        </g>
      )}

      {/* Corner Prop Badge */}
      <g transform="translate(70, 68)">
        <circle cx="12" cy="12" r="12" fill="#FFFFFF" stroke="rgba(15,23,42,0.12)" strokeWidth="1.5" />
        {prop === 'star' && (
          <polygon
            points="12,4 14.5,9.2 20,10 16,13.8 17,19.5 12,16.8 7,19.5 8,13.8 4,10 9.5,9.2"
            fill="#FACC15"
          />
        )}
        {prop === 'trophy' && (
          <path d="M7,6 H17 V11 C17,14 14.8,16 12,16 C9.2,16 7,14 7,11 Z M10,16 H14 V19 H10 Z" fill="#F59E0B" />
        )}
        {prop === 'lightning' && (
          <polygon points="13,4 7,13 12,13 10,20 17,11 12,11" fill="#FACC15" />
        )}
        {prop === 'heart' && (
          <path d="M12,19 C12,19 5,14.5 5,9.8 C5,7.4 7,5.8 9.2,5.8 C10.6,5.8 11.6,6.6 12,7.5 C12.4,6.6 13.4,5.8 14.8,5.8 C17,5.8 19,7.4 19,9.8 C19,14.5 12,19 12,19 Z" fill="#EC4899" />
        )}
        {prop === 'calculator' && (
          <g>
            <rect x="6" y="5" width="12" height="14" rx="2" fill="#2563EB" />
            <rect x="8" y="7" width="8" height="3" rx="0.5" fill="#E0F2FE" />
            <circle cx="9" cy="13" r="1" fill="#FFFFFF" />
            <circle cx="12" cy="13" r="1" fill="#FFFFFF" />
            <circle cx="15" cy="13" r="1" fill="#FFFFFF" />
            <circle cx="9" cy="16" r="1" fill="#FFFFFF" />
            <circle cx="12" cy="16" r="1" fill="#FFFFFF" />
            <circle cx="15" cy="16" r="1" fill="#FACC15" />
          </g>
        )}
        {prop === 'planet' && (
          <g>
            <circle cx="12" cy="12" r="5.5" fill="#7C3AED" />
            <ellipse cx="12" cy="12" rx="9.5" ry="2.5" fill="none" stroke="#38BDF8" strokeWidth="1.6" transform="rotate(-20 12 12)" />
          </g>
        )}
      </g>
    </svg>
  );
}

export function AvatarDisplay({
  avatarId,
  customSpec,
  name = 'Awatar',
  sizeClass = 'w-16 h-16 sm:w-20 sm:h-20',
  overrideSpec,
}: AvatarDisplayProps) {
  const [imgFailed, setImgFailed] = useState(false);

  if (overrideSpec) {
    return (
      <div className={`${sizeClass} rounded-2xl overflow-hidden border border-[var(--th-border)] shrink-0`}>
        <AvatarSvg spec={overrideSpec} />
      </div>
    );
  }

  const illustratedSrc = ILLUSTRATED_MASCOT_MAP[avatarId];
  if (illustratedSrc && !imgFailed) {
    return (
      <img
        src={illustratedSrc}
        alt={`Awatar ucznia ${name}`}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${sizeClass} rounded-2xl object-cover border border-[var(--th-border)] shrink-0 bg-[#F7F9FC]`}
      />
    );
  }

  const preset = findPresetAvatar(avatarId);
  const resolvedSpec: AvatarSpec =
    avatarId === 'custom' && customSpec
      ? customSpec
      : preset?.spec ??
        (avatarId === 'fox' || avatarId === 'mascot-fox'
          ? findPresetAvatar('av-02')!.spec
          : avatarId === 'mascot-cat'
          ? findPresetAvatar('av-03')!.spec
          : avatarId === 'mascot-panda'
          ? findPresetAvatar('av-05')!.spec
          : avatarId === 'mascot-robot'
          ? findPresetAvatar('av-17')!.spec
          : avatarId === 'mascot-dragon'
          ? findPresetAvatar('av-46')!.spec
          : avatarId === 'mascot-unicorn'
          ? findPresetAvatar('av-44')!.spec
          : avatarId === 'mascot-lion'
          ? findPresetAvatar('av-07')!.spec
          : avatarId === 'mascot-penguin'
          ? findPresetAvatar('av-10')!.spec
          : avatarId === 'rocket'
          ? findPresetAvatar('av-20')!.spec
          : avatarId === 'star'
          ? findPresetAvatar('av-45')!.spec
          : DEFAULT_FALLBACK_SPEC);

  return (
    <div
      className={`${sizeClass} rounded-2xl overflow-hidden border border-[var(--th-border)] shrink-0`}
      role="img"
      aria-label={`Awatar ucznia ${name}`}
    >
      <AvatarSvg spec={resolvedSpec} />
    </div>
  );
}
