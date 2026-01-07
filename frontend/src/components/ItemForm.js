import React, { useState, useEffect } from 'react';
import { FaSave, FaTimes, FaPlus } from 'react-icons/fa';
import './ItemForm.css';

function ItemForm({ onSubmit, editingItem, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Other',
    status: 'Pending',
    priority: 'Medium'
  });

  useEffect(() => {
    if (editingItem) {
      setFormData(editingItem);
    } else {
      setFormData({
        title: '',
        description: '',
        category: 'Other',
        status: 'Pending',
        priority: 'Medium'
      });
    }
  }, [editingItem]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingItem) {
      onSubmit(editingItem._id, formData);
    } else {
      onSubmit(formData);
    }
    setFormData({
      title: '',
      description: '',
      category: 'Other',
      status: 'Pending',
      priority: 'Medium'
    });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="item-form-container">
      <div className="form-header">
        <h2>{editingItem ? 'Edit Task' : 'Create New Task'}</h2>
        <p className="form-subtitle">
          {editingItem ? 'Update your task details' : 'Add a new task to your list'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="item-form">
        <div className="form-group">
          <label htmlFor="title">
            Title <span className="required">*</span>
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter task title..."
            required
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">
            Description <span className="required">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe your task..."
            rows="4"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
            >
              <option value="Work">Work</option>
              <option value="Personal">Personal</option>
              <option value="Shopping">Shopping</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="priority">Priority</label>
            <select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleChange}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
          >
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        <div className="form-actions">
          {editingItem && (
            <button type="button" onClick={onCancel} className="btn btn-cancel">
              <FaTimes /> Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary">
            {editingItem ? (
              <>
                <FaSave /> Update Task
              </>
            ) : (
              <>
                <FaPlus /> Add Task
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ItemForm;
