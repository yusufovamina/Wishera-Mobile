import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface IconProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  style?: any;
}

export const Icon: React.FC<IconProps> = ({ 
  name, 
  size = 24, 
  color = colors.text,
  style 
}) => {
  return <Ionicons name={name} size={size} color={color} style={style} />;
};

export const CallIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="call" size={size} color={color} style={style} />;

export const VideoCallIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="videocam" size={size} color={color} style={style} />;

export const MicIcon: React.FC<{ size?: number; color?: string; style?: any; muted?: boolean }> = ({ 
  size = 24, 
  color = colors.text,
  style,
  muted = false
}) => <Icon name={muted ? "mic-off" : "mic"} size={size} color={color} style={style} />;

export const CameraIcon: React.FC<{ size?: number; color?: string; style?: any; enabled?: boolean }> = ({ 
  size = 24, 
  color = colors.text,
  style,
  enabled = true
}) => <Icon name={enabled ? "camera" : "camera-outline"} size={size} color={color} style={style} />;

export const FlipCameraIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="camera-reverse" size={size} color={color} style={style} />;

export const CloseIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="close" size={size} color={color} style={style} />;

export const CheckIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="checkmark" size={size} color={color} style={style} />;

export const HomeIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="home" size={size} color={color} style={style} />;

export const ChatIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="chatbubbles" size={size} color={color} style={style} />;

export const NotificationsIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="notifications" size={size} color={color} style={style} />;

export const ProfileIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="person" size={size} color={color} style={style} />;

export const VoiceMessageIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="mic-circle" size={size} color={color} style={style} />;

export const ImageIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="image" size={size} color={color} style={style} />;

export const VideoIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="videocam" size={size} color={color} style={style} />;

export const SendIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="send" size={size} color={color} style={style} />;

export const EmojiIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="happy" size={size} color={color} style={style} />;

export const PaletteIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="color-palette" size={size} color={color} style={style} />;

export const MoreIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="ellipsis-horizontal" size={size} color={color} style={style} />;

export const BackIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="arrow-back" size={size} color={color} style={style} />;

export const GiftIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="gift" size={size} color={color} style={style} />;

export const HeartIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="heart" size={size} color={color} style={style} />;

export const CalendarIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="calendar" size={size} color={color} style={style} />;

export const EditIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="create" size={size} color={color} style={style} />;

export const AddIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="add" size={size} color={color} style={style} />;

export const ListIcon: React.FC<{ size?: number; color?: string; style?: any }> = ({ 
  size = 24, 
  color = colors.text,
  style 
}) => <Icon name="list" size={size} color={color} style={style} />;

