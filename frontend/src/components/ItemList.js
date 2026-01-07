import React from 'react';
import { FaEdit, FaTrash, FaClock, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import './ItemList.css';

function ItemList({ items, onEdit, onDelete }) {
  const getPriorityClass = (priority) => {
    return `priority-${priority.toLowerCase()}`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed':
        return <FaCheckCircle />;
      case 'In Progress':
        return <FaClock />;
      default:
        return <FaExclamationCircle />;
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📝</div>
        <h3>No tasks found</h3>
        <p>Create your first task to get started!</p>
      </div>
    );
  }

  return (
    <div className="item-list">
      {items.map((item) => (
        <div key={item._id} className={`item-card ${item.status === 'Completed' ? 'completed' : ''}`}>
          <div className="item-header">
            <div className="item-title-section">
              <h3 className="item-title">{item.title}</h3>
              <div className="item-badges">
                <span className={`badge badge-status ${item.status.toLowerCase().replace(' ', '-')}`}>
                  {getStatusIcon(item.status)}
                  {item.status}
                </span>
                <span className={`badge badge-priority ${getPriorityClass(item.priority)}`}>
                  {item.priority}
                </span>
                <span className="badge badge-category">
                  {item.category}
                </span>
              </div>
            </div>
          </div>

          <p className="item-description">{item.description}</p>

          <div className="item-footer">
            <div className="item-date">
              <FaClock className="date-icon" />
              <span>Created: {formatDate(item.createdAt)}</span>
            </div>
            <div className="item-actions">
              <button
                onClick={() => onEdit(item)}
                className="action-btn edit-btn"
                title="Edit"
              >
                <FaEdit />
              </button>
              <button
                onClick={() => onDelete(item._id)}
                className="action-btn delete-btn"
                title="Delete"
              >
                <FaTrash />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ItemList;
