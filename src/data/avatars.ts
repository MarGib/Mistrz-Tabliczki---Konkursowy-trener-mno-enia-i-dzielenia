import type {
  AvatarAccessory,
  AvatarCharacter,
  AvatarPreset,
  AvatarProp,
} from '../types/math';

const CATEGORIES: AvatarPreset['category'][] = [
  'Zwierzęta',
  'Kosmos i Roboty',
  'Mistrzowie i Sport',
  'Fantazja',
];

const CURATED_SPECS: {
  id: string;
  name: string;
  category: AvatarPreset['category'];
  character: AvatarCharacter;
  bgColor: string;
  bodyColor: string;
  accessory: AvatarAccessory;
  prop: AvatarProp;
}[] = [
  // Zwierzęta (16)
  { id: 'av-01', name: 'Mądra Sowa', category: 'Zwierzęta', character: 'owl', bgColor: '#D1FAE5', bodyColor: '#059669', accessory: 'glasses', prop: 'star' },
  { id: 'av-02', name: 'Sprytny Lis', category: 'Zwierzęta', character: 'fox', bgColor: '#FFEDD5', bodyColor: '#EA580C', accessory: 'none', prop: 'lightning' },
  { id: 'av-03', name: 'Fioletowy Kotek', category: 'Zwierzęta', character: 'cat', bgColor: '#EDE9FE', bodyColor: '#7C3AED', accessory: 'glasses', prop: 'heart' },
  { id: 'av-04', name: 'Wesoły Piesek', category: 'Zwierzęta', character: 'dog', bgColor: '#FEF9C3', bodyColor: '#D97706', accessory: 'cap', prop: 'trophy' },
  { id: 'av-05', name: 'Panda Matematyk', category: 'Zwierzęta', character: 'panda', bgColor: '#E2E8F0', bodyColor: '#334155', accessory: 'glasses', prop: 'calculator' },
  { id: 'av-06', name: 'Złoty Miś', category: 'Zwierzęta', character: 'bear', bgColor: '#FEF3C7', bodyColor: '#B45309', accessory: 'crown', prop: 'star' },
  { id: 'av-07', name: 'Król Lew', category: 'Zwierzęta', character: 'lion', bgColor: '#FFEDD5', bodyColor: '#EA580C', accessory: 'crown', prop: 'trophy' },
  { id: 'av-08', name: 'Szybki Królik', category: 'Zwierzęta', character: 'rabbit', bgColor: '#FCE7F3', bodyColor: '#DB2777', accessory: 'headphones', prop: 'lightning' },
  { id: 'av-09', name: 'Zielona Żabka', category: 'Zwierzęta', character: 'frog', bgColor: '#DCFCE7', bodyColor: '#16A34A', accessory: 'crown', prop: 'heart' },
  { id: 'av-10', name: 'Błękitny Pingwin', category: 'Zwierzęta', character: 'penguin', bgColor: '#DBEAFE', bodyColor: '#2563EB', accessory: 'headphones', prop: 'star' },
  { id: 'av-11', name: 'Sowa Królewska', category: 'Zwierzęta', character: 'owl', bgColor: '#EDE9FE', bodyColor: '#6D28D9', accessory: 'crown', prop: 'trophy' },
  { id: 'av-12', name: 'Lis Błyskawica', category: 'Zwierzęta', character: 'fox', bgColor: '#FEE2E2', bodyColor: '#DC2626', accessory: 'cap', prop: 'lightning' },
  { id: 'av-13', name: 'Kotek DJ', category: 'Zwierzęta', character: 'cat', bgColor: '#CFFAFE', bodyColor: '#0891B2', accessory: 'headphones', prop: 'star' },
  { id: 'av-14', name: 'Miś Polarnik', category: 'Zwierzęta', character: 'bear', bgColor: '#E0F2FE', bodyColor: '#0284C7', accessory: 'glasses', prop: 'planet' },
  { id: 'av-15', name: 'Królik Bystrzak', category: 'Zwierzęta', character: 'rabbit', bgColor: '#EDE9FE', bodyColor: '#8B5CF6', accessory: 'glasses', prop: 'calculator' },
  { id: 'av-16', name: 'Żabka Skoczek', category: 'Zwierzęta', character: 'frog', bgColor: '#FEF9C3', bodyColor: '#15803D', accessory: 'cap', prop: 'lightning' },

  // Kosmos i Roboty (14)
  { id: 'av-17', name: 'Turbo Robot', category: 'Kosmos i Roboty', character: 'robot', bgColor: '#DBEAFE', bodyColor: '#1D4ED8', accessory: 'none', prop: 'calculator' },
  { id: 'av-18', name: 'Kosmita Błysk', category: 'Kosmos i Roboty', character: 'alien', bgColor: '#D1FAE5', bodyColor: '#10B981', accessory: 'glasses', prop: 'planet' },
  { id: 'av-19', name: 'Astronauta Max', category: 'Kosmos i Roboty', character: 'astronaut', bgColor: '#1E293B', bodyColor: '#38BDF8', accessory: 'none', prop: 'planet' },
  { id: 'av-20', name: 'Rakieta Start', category: 'Kosmos i Roboty', character: 'rocket', bgColor: '#FEE2E2', bodyColor: '#CE1141', accessory: 'none', prop: 'star' },
  { id: 'av-21', name: 'Fioletowy Robot', category: 'Kosmos i Roboty', character: 'robot', bgColor: '#EDE9FE', bodyColor: '#7C3AED', accessory: 'headphones', prop: 'lightning' },
  { id: 'av-22', name: 'Gwiezdny Astronauta', category: 'Kosmos i Roboty', character: 'astronaut', bgColor: '#312E81', bodyColor: '#A78BFA', accessory: 'halo', prop: 'star' },
  { id: 'av-23', name: 'Złoty Android', category: 'Kosmos i Roboty', character: 'robot', bgColor: '#FEF3C7', bodyColor: '#D97706', accessory: 'crown', prop: 'trophy' },
  { id: 'av-24', name: 'Kosmita Neo', category: 'Kosmos i Roboty', character: 'alien', bgColor: '#1E293B', bodyColor: '#22C55E', accessory: 'headphones', prop: 'lightning' },
  { id: 'av-25', name: 'Rakieta Błękitna', category: 'Kosmos i Roboty', character: 'rocket', bgColor: '#DBEAFE', bodyColor: '#2563EB', accessory: 'none', prop: 'planet' },
  { id: 'av-26', name: 'Rakieta Złota', category: 'Kosmos i Roboty', character: 'rocket', bgColor: '#0F172A', bodyColor: '#F59E0B', accessory: 'none', prop: 'trophy' },
  { id: 'av-27', name: 'Cyber Piesek', category: 'Kosmos i Roboty', character: 'dog', bgColor: '#1E293B', bodyColor: '#38BDF8', accessory: 'glasses', prop: 'calculator' },
  { id: 'av-28', name: 'Pingwin Astronauta', category: 'Kosmos i Roboty', character: 'penguin', bgColor: '#0F172A', bodyColor: '#60A5FA', accessory: 'halo', prop: 'planet' },
  { id: 'av-29', name: 'Kotek Kosmita', category: 'Kosmos i Roboty', character: 'cat', bgColor: '#1E1B4B', bodyColor: '#C084FC', accessory: 'none', prop: 'planet' },
  { id: 'av-30', name: 'Sowa Galaktyczna', category: 'Kosmos i Roboty', character: 'owl', bgColor: '#0F172A', bodyColor: '#38BDF8', accessory: 'glasses', prop: 'planet' },

  // Mistrzowie i Sport (12)
  { id: 'av-31', name: 'Mistrz Bulls', category: 'Mistrzowie i Sport', character: 'lion', bgColor: '#FEE2E2', bodyColor: '#CE1141', accessory: 'cap', prop: 'trophy' },
  { id: 'av-32', name: 'Czempion Korony', category: 'Mistrzowie i Sport', character: 'knight', bgColor: '#DBEAFE', bodyColor: '#1D4ED8', accessory: 'crown', prop: 'trophy' },
  { id: 'av-33', name: 'Sprinter Fiolet', category: 'Mistrzowie i Sport', character: 'fox', bgColor: '#EDE9FE', bodyColor: '#7C3AED', accessory: 'cap', prop: 'lightning' },
  { id: 'av-34', name: 'Kapitan Panda', category: 'Mistrzowie i Sport', character: 'panda', bgColor: '#D1FAE5', bodyColor: '#16A34A', accessory: 'cap', prop: 'trophy' },
  { id: 'av-35', name: 'Piesek Zwycięzca', category: 'Mistrzowie i Sport', character: 'dog', bgColor: '#FEE2E2', bodyColor: '#DC2626', accessory: 'crown', prop: 'trophy' },
  { id: 'av-36', name: 'Rycerz Liczb', category: 'Mistrzowie i Sport', character: 'knight', bgColor: '#F1F5F9', bodyColor: '#334155', accessory: 'none', prop: 'calculator' },
  { id: 'av-37', name: 'Król Tabliczki', category: 'Mistrzowie i Sport', character: 'bear', bgColor: '#FEF9C3', bodyColor: '#CA8A04', accessory: 'crown', prop: 'calculator' },
  { id: 'av-38', name: 'Błyskawica Kot', category: 'Mistrzowie i Sport', character: 'cat', bgColor: '#FEF9C3', bodyColor: '#EAB308', accessory: 'cap', prop: 'lightning' },
  { id: 'av-39', name: 'Lew Finału', category: 'Mistrzowie i Sport', character: 'lion', bgColor: '#DBEAFE', bodyColor: '#2563EB', accessory: 'glasses', prop: 'trophy' },
  { id: 'av-40', name: 'Pingwin Trener', category: 'Mistrzowie i Sport', character: 'penguin', bgColor: '#FEE2E2', bodyColor: '#DC2626', accessory: 'cap', prop: 'trophy' },
  { id: 'av-41', name: 'Królik Rekordzista', category: 'Mistrzowie i Sport', character: 'rabbit', bgColor: '#D1FAE5', bodyColor: '#059669', accessory: 'none', prop: 'trophy' },
  { id: 'av-42', name: 'Rycerz Złoty', category: 'Mistrzowie i Sport', character: 'knight', bgColor: '#FEF3C7', bodyColor: '#D97706', accessory: 'crown', prop: 'star' },

  // Fantazja (12)
  { id: 'av-43', name: 'Fioletowy Smok', category: 'Fantazja', character: 'dragon', bgColor: '#EDE9FE', bodyColor: '#7C3AED', accessory: 'none', prop: 'star' },
  { id: 'av-44', name: 'Tęczowy Jednorożec', category: 'Fantazja', character: 'unicorn', bgColor: '#FCE7F3', bodyColor: '#DB2777', accessory: 'crown', prop: 'heart' },
  { id: 'av-45', name: 'Czarodziej Liczb', category: 'Fantazja', character: 'wizard', bgColor: '#E0E7FF', bodyColor: '#4338CA', accessory: 'glasses', prop: 'star' },
  { id: 'av-46', name: 'Szmaragdowy Smok', category: 'Fantazja', character: 'dragon', bgColor: '#D1FAE5', bodyColor: '#059669', accessory: 'crown', prop: 'trophy' },
  { id: 'av-47', name: 'Błękitny Jednorożec', category: 'Fantazja', character: 'unicorn', bgColor: '#DBEAFE', bodyColor: '#2563EB', accessory: 'halo', prop: 'star' },
  { id: 'av-48', name: 'Magik Fioletu', category: 'Fantazja', character: 'wizard', bgColor: '#EDE9FE', bodyColor: '#6D28D9', accessory: 'none', prop: 'lightning' },
  { id: 'av-49', name: 'Czerwony Smok', category: 'Fantazja', character: 'dragon', bgColor: '#FEE2E2', bodyColor: '#CE1141', accessory: 'glasses', prop: 'lightning' },
  { id: 'av-50', name: 'Złoty Jednorożec', category: 'Fantazja', character: 'unicorn', bgColor: '#FEF9C3', bodyColor: '#D97706', accessory: 'crown', prop: 'star' },
  { id: 'av-51', name: 'Mistrz Magii', category: 'Fantazja', character: 'wizard', bgColor: '#1E293B', bodyColor: '#38BDF8', accessory: 'glasses', prop: 'planet' },
  { id: 'av-52', name: 'Anielski Smok', category: 'Fantazja', character: 'dragon', bgColor: '#E0F2FE', bodyColor: '#0284C7', accessory: 'halo', prop: 'heart' },
  { id: 'av-53', name: 'Sowa Czarodziejka', category: 'Fantazja', character: 'owl', bgColor: '#FCE7F3', bodyColor: '#BE185D', accessory: 'crown', prop: 'star' },
  { id: 'av-54', name: 'Kosmokot Mag', category: 'Fantazja', character: 'cat', bgColor: '#FEF3C7', bodyColor: '#7C3AED', accessory: 'halo', prop: 'lightning' },
];

export const PRESET_AVATARS: AvatarPreset[] = CURATED_SPECS.map((item) => ({
  id: item.id,
  name: item.name,
  category: item.category,
  spec: {
    character: item.character,
    bgColor: item.bgColor,
    bodyColor: item.bodyColor,
    accessory: item.accessory,
    prop: item.prop,
  },
}));

export interface IllustratedMascotDef {
  id: string;
  name: string;
}

export const ILLUSTRATED_MASCOTS: IllustratedMascotDef[] = [
  { id: 'owl', name: 'Mądra Sowa' },
  { id: 'mascot-fox', name: 'Sprytny Lis' },
  { id: 'mascot-cat', name: 'Kosmiczny Kotek' },
  { id: 'mascot-panda', name: 'Panda Mistrz' },
  { id: 'mascot-robot', name: 'Turbo Robot' },
  { id: 'mascot-dragon', name: 'Zielony Smok' },
  { id: 'mascot-unicorn', name: 'Gwiezdny Jednorożec' },
  { id: 'mascot-lion', name: 'Odważny Lew' },
  { id: 'mascot-penguin', name: 'Pingwin Odkrywca' },
];

export const AVATAR_CATEGORIES = CATEGORIES;

export function findPresetAvatar(avatarId: string): AvatarPreset | undefined {
  return PRESET_AVATARS.find((a) => a.id === avatarId);
}
