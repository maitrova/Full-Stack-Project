import React, { useState, useEffect } from 'react';
import './App.css';
import ItemList from './components/ItemList';
import ItemForm from './components/ItemForm';
import Header from './components/Header';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [items, setItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/items`);
      const data = await response.json();
      setItems(data);
      setError('');
    } catch (err) {
      setError('Failed to fetch items. Please check if the server is running.');
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (itemData) => {
    try {
      const response = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(itemData),
      });
      const data = await response.json();
      setItems([data, ...items]);
      setError('');
    } catch (err) {
      setError('Failed to add item');
      console.error('Error adding item:', err);
    }
  };

  const updateItem = async (id, itemData) => {
    try {
      const response = await fetch(`${API_URL}/items/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(itemData),
      });
      const data = await response.json();
      setItems(items.map(item => (item._id === id ? data : item)));
      setEditingItem(null);
      setError('');
    } catch (err) {
      setError('Failed to update item');
      console.error('Error updating item:', err);
    }
  };

  const deleteItem = async (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await fetch(`${API_URL}/items/${id}`, {
          method: 'DELETE',
        });
        setItems(items.filter(item => item._id !== id));
        setError('');
      } catch (err) {
        setError('Failed to delete item');
        console.error('Error deleting item:', err);
      }
    }
  };

  const filteredItems = items.filter(item => {
    const statusMatch = filterStatus === 'All' || item.status === filterStatus;
    const categoryMatch = filterCategory === 'All' || item.category === filterCategory;
    return statusMatch && categoryMatch;
  });

  return (
    <div className="App">
      <Header />
      <div className="container">
        {error && <div className="error-message">{error}</div>}
        
        <div className="main-content">
          <div className="form-section">
            <ItemForm
              onSubmit={editingItem ? updateItem : addItem}
              editingItem={editingItem}
              onCancel={() => setEditingItem(null)}
            />
          </div>

          <div className="list-section">
            <div className="filters">
              <div className="filter-group">
                <label>Status:</label>
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="filter-select"
                >
                  <option value="All">All</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Category:</label>
                <select 
                  value={filterCategory} 
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="filter-select"
                >
                  <option value="All">All</option>
                  <option value="Work">Work</option>
                  <option value="Personal">Personal</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="loading">Loading...</div>
            ) : (
              <ItemList
                items={filteredItems}
                onEdit={setEditingItem}
                onDelete={deleteItem}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
