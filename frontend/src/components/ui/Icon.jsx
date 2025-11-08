import React from 'react';
import * as LucideIcons from 'lucide-react';

/**
 * Reusable Icon component that uses Lucide React icons
 * @param {string} name - The name of the Lucide icon (e.g., 'User', 'Settings', 'Home')
 * @param {number} size - Size of the icon in pixels (default: 24)
 * @param {string} color - Color of the icon (default: 'currentColor')
 * @param {string} className - Additional CSS classes
 * @param {object} props - Additional props to pass to the icon component
 */
const Icon = ({ name, size = 24, color = 'currentColor', className = '', ...props }) => {
  // Get the icon component from Lucide
  const IconComponent = LucideIcons[name];
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in Lucide React icons`);
    return null;
  }
  
  return (
    <IconComponent
      size={size}
      color={color}
      className={className}
      {...props}
    />
  );
};

export default Icon;

// Export commonly used icons for convenience
export const UserIcon = (props) => <Icon name="User" {...props} />;
export const SettingsIcon = (props) => <Icon name="Settings" {...props} />;
export const HomeIcon = (props) => <Icon name="Home" {...props} />;
export const PlusIcon = (props) => <Icon name="Plus" {...props} />;
export const EditIcon = (props) => <Icon name="Edit" {...props} />;
export const TrashIcon = (props) => <Icon name="Trash2" {...props} />;
export const SearchIcon = (props) => <Icon name="Search" {...props} />;
export const MenuIcon = (props) => <Icon name="Menu" {...props} />;
export const XIcon = (props) => <Icon name="X" {...props} />;
export const ChevronDownIcon = (props) => <Icon name="ChevronDown" {...props} />;
export const ChevronUpIcon = (props) => <Icon name="ChevronUp" {...props} />;
export const LogOutIcon = (props) => <Icon name="LogOut" {...props} />;
export const EyeIcon = (props) => <Icon name="Eye" {...props} />;
export const EyeOffIcon = (props) => <Icon name="EyeOff" {...props} />;
export const GamepadIcon = (props) => <Icon name="Gamepad2" {...props} />;
export const TrophyIcon = (props) => <Icon name="Trophy" {...props} />;
export const BarChartIcon = (props) => <Icon name="BarChart3" {...props} />;
export const UsersIcon = (props) => <Icon name="Users" {...props} />;
export const CalendarIcon = (props) => <Icon name="Calendar" {...props} />;
export const ClockIcon = (props) => <Icon name="Clock" {...props} />;
export const StarIcon = (props) => <Icon name="Star" {...props} />;
export const FilterIcon = (props) => <Icon name="Filter" {...props} />;
export const RefreshIcon = (props) => <Icon name="RefreshCw" {...props} />;
export const ArrowLeftIcon = (props) => <Icon name="ArrowLeft" {...props} />;
export const ArrowRightIcon = (props) => <Icon name="ArrowRight" {...props} />;
export const ArrowLeftCircleIcon = (props) => <Icon name="ArrowLeftCircle" {...props} />;
export const SaveIcon = (props) => <Icon name="Save" {...props} />;
export const PauseIcon = (props) => <Icon name="Pause" {...props} />;
export const PlayIcon = (props) => <Icon name="Play" {...props} />;
export const StatIcon = (props) => <Icon name="BarChart2" {...props} />;
export const ChartLineIcon = (props) => <Icon name="LineChart" {...props} />;
export const DownloadIcon = (props) => <Icon name="Download" {...props} />;
export const UploadIcon = (props) => <Icon name="Upload" {...props} />;
export const CloudIcon = (props) => <Icon name="Cloud" {...props} />;
export const ShareIcon = (props) => <Icon name="Share2" {...props} />;
export const LinkIcon = (props) => <Icon name="Link" {...props} />;
export const FileIcon = (props) => <Icon name="File" {...props} />;
export const TableIcon = (props) => <Icon name="Table" {...props} />;
export const CopyIcon = (props) => <Icon name="Copy" {...props} />;
export const CheckMarkIcon = (props) => <Icon name="Check" {...props} />;
export const DiceIcon = (props) => <Icon name="Dices" {...props} />;
export const BombIcon = (props) => <Icon name="Bomb" {...props} />;
export const ListIcon = (props) => <Icon name="List" {...props} />;

