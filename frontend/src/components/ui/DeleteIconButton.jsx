import PropTypes from 'prop-types';
import { TrashIcon } from '@/components/ui/Icon';
import '@/styles/components/delete-icon-button.css';

/**
 * The one icon-only delete/remove button for list rows: a muted trash icon
 * that turns red on hover. The label doubles as tooltip and accessible name.
 */
const DeleteIconButton = ({ label, onClick, disabled = false, className = '' }) => (
  <button
    type="button"
    className={`delete-icon-btn ${className}`.trim()}
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
  >
    <TrashIcon size={18} aria-hidden="true" />
  </button>
);

DeleteIconButton.propTypes = {
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default DeleteIconButton;
