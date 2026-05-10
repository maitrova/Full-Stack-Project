// Updated ZoneManager.jsx with fixes for the error
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, Edit2, Move, ArrowUp, ArrowDown } from 'lucide-react';

// Default zones configuration with complete data
const DEFAULT_ZONES = [
  { 
    id: 'front-full', 
    name: 'Front Full', 
    specKey: 'front', 
    boundaries: { minX: 0.3, maxX: 0.7, minY: 0.25, maxY: 0.65 },
    spec: { maxW: 12, maxH: 14 },
    viewCode: 'front'
  },
  { 
    id: 'pocket', 
    name: 'Pocket', 
    specKey: 'pocket', 
    boundaries: { minX: 0.365, maxX: 0.635, minY: 0.67, maxY: 0.87 },
    spec: { maxW: 8, maxH: 7 },
    viewCode: 'front'
  },
  { 
    id: 'sleeve-left', 
    name: 'Sleeve Left', 
    specKey: 'sleeve', 
    boundaries: { minX: 0.15, maxX: 0.3, minY: 0.18, maxY: 0.32 },
    spec: { maxW: 4, maxH: 4 },
    viewCode: 'front'
  },
  { 
    id: 'sleeve-right', 
    name: 'Sleeve Right', 
    specKey: 'sleeve', 
    boundaries: { minX: 0.7, maxX: 0.85, minY: 0.18, maxY: 0.32 },
    spec: { maxW: 4, maxH: 4 },
    viewCode: 'front'
  },
  { 
    id: 'back-full', 
    name: 'Back Full', 
    specKey: 'back', 
    boundaries: { minX: 0.3, maxX: 0.7, minY: 0.25, maxY: 0.75 },
    spec: { maxW: 12, maxH: 20 },
    viewCode: 'back'
  }
];

const ZoneManager = ({ 
  isOpen, 
  onClose, 
  onSaveZones,
  productKey = 'hoodie_basic',
  initialZones = null
}) => {
  const [zones, setZones] = useState(DEFAULT_ZONES);
  const [editingZone, setEditingZone] = useState(null);
  const [newZone, setNewZone] = useState({
    name: '',
    specKey: 'front',
    boundaries: { minX: 0.4, maxX: 0.6, minY: 0.4, maxY: 0.6 },
    spec: { maxW: 10, maxH: 12 },
    viewCode: 'front'
  });

  // Load initial zones
  useEffect(() => {
    if (initialZones) {
      // Merge initial zones with default boundaries and specs
      const mergedZones = initialZones.map(zone => {
        const defaultZone = DEFAULT_ZONES.find(dz => dz.id === zone.id);
        return {
          ...zone,
          boundaries: zone.boundaries || defaultZone?.boundaries || { minX: 0.4, maxX: 0.6, minY: 0.4, maxY: 0.6 },
          spec: zone.spec || defaultZone?.spec || { maxW: 10, maxH: 12 },
          viewCode: zone.viewCode || defaultZone?.viewCode || 'front'
        };
      });
      setZones(mergedZones);
    }
  }, [initialZones]);

  const handleSaveZone = () => {
    if (!newZone.name.trim()) {
      alert('Please enter a zone name');
      return;
    }

    const zoneId = newZone.name.toLowerCase().replace(/\s+/g, '-');
    const updatedZones = [...zones, { 
      ...newZone, 
      id: zoneId 
    }];
    
    setZones(updatedZones);
    setNewZone({
      name: '',
      specKey: 'front',
      boundaries: { minX: 0.4, maxX: 0.6, minY: 0.4, maxY: 0.6 },
      spec: { maxW: 10, maxH: 12 },
      viewCode: 'front'
    });
  };

  const handleDeleteZone = (zoneId) => {
    if (zones.length <= 1) {
      alert('At least one zone is required');
      return;
    }
    setZones(zones.filter(zone => zone.id !== zoneId));
  };

  const handleUpdateZone = (zoneId, updates) => {
    setZones(zones.map(zone => 
      zone.id === zoneId ? { ...zone, ...updates } : zone
    ));
  };

  const handleEditZone = (zone) => {
    setEditingZone({ ...zone });
  };

  const saveEdit = () => {
    if (!editingZone.name.trim()) {
      alert('Zone name cannot be empty');
      return;
    }
    
    // Ensure boundaries exist
    if (!editingZone.boundaries) {
      editingZone.boundaries = { minX: 0.4, maxX: 0.6, minY: 0.4, maxY: 0.6 };
    }
    
    // Ensure spec exists
    if (!editingZone.spec) {
      editingZone.spec = { maxW: 10, maxH: 12 };
    }
    
    setZones(zones.map(zone => 
      zone.id === editingZone.id ? editingZone : zone
    ));
    setEditingZone(null);
  };

  const handleMoveZone = (index, direction) => {
    if (direction === 'up' && index > 0) {
      const newZones = [...zones];
      [newZones[index], newZones[index - 1]] = [newZones[index - 1], newZones[index]];
      setZones(newZones);
    } else if (direction === 'down' && index < zones.length - 1) {
      const newZones = [...zones];
      [newZones[index], newZones[index + 1]] = [newZones[index + 1], newZones[index]];
      setZones(newZones);
    }
  };

  const handleSaveAll = () => {
    // Transform zones into the format expected by the editor
    const boundariesMap = {};
    const specsMap = {};
    
    zones.forEach(zone => {
      // Ensure boundaries exist before adding to map
      if (zone.boundaries) {
        boundariesMap[zone.id] = zone.boundaries;
      }
      
      if (zone.spec && zone.specKey) {
        specsMap[zone.specKey] = zone.spec;
      }
    });

    const finalConfig = {
      productKey,
      boundaries: boundariesMap,
      specs: specsMap,
      zones: zones.map(zone => ({
        id: zone.id,
        name: zone.name,
        specKey: zone.specKey,
        spec: zone.spec,
        boundaries: zone.boundaries,
        viewCode: zone.viewCode || getViewFromZoneId(zone.id)
      }))
    };

    onSaveZones(finalConfig);
    onClose();
  };

  const getViewFromZoneId = (zoneId) => {
    if (zoneId.includes('back')) return 'back';
    if (zoneId.includes('sleeve')) return zoneId.includes('left') ? 'left' : 'right';
    return 'front';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Print Zone Manager</h2>
            <p className="text-sm text-slate-600 mt-1">
              Define custom print areas with boundaries and inch specifications
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Zones List */}
          <div className="w-1/2 border-r border-slate-200 p-6 overflow-y-auto">
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800 mb-4">Manage Zones</h3>
              
              {/* Add New Zone */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                <h4 className="font-medium text-slate-700 mb-3">Add New Zone</h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Zone Name (e.g., Front Logo)"
                    value={newZone.name}
                    onChange={(e) => setNewZone({...newZone, name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                  <select
                    value={newZone.specKey}
                    onChange={(e) => setNewZone({...newZone, specKey: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  >
                    <option value="front">Front</option>
                    <option value="pocket">Pocket</option>
                    <option value="sleeve">Sleeve</option>
                    <option value="back">Back</option>
                    <option value="custom">Custom</option>
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-600">Max Width (inches)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="30"
                        value={newZone.spec.maxW}
                        onChange={(e) => setNewZone({
                          ...newZone, 
                          spec: { ...newZone.spec, maxW: parseFloat(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600">Max Height (inches)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="30"
                        value={newZone.spec.maxH}
                        onChange={(e) => setNewZone({
                          ...newZone, 
                          spec: { ...newZone.spec, maxH: parseFloat(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSaveZone}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Zone
                  </button>
                </div>
              </div>

              {/* Zones List */}
              <div className="space-y-3">
                {zones.map((zone, index) => {
                  // Ensure boundaries and spec exist
                  const boundaries = zone.boundaries || { minX: 0.4, maxX: 0.6, minY: 0.4, maxY: 0.6 };
                  const spec = zone.spec || { maxW: 10, maxH: 12 };
                  
                  return (
                    <div 
                      key={zone.id} 
                      className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Move className="w-4 h-4 text-slate-400" />
                          <div>
                            <h4 className="font-medium text-slate-800">{zone.name}</h4>
                            <p className="text-xs text-slate-500">{zone.id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMoveZone(index, 'up')}
                            disabled={index === 0}
                            className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                          >
                            <ArrowUp className="w-4 h-4 text-slate-600" />
                          </button>
                          <button
                            onClick={() => handleMoveZone(index, 'down')}
                            disabled={index === zones.length - 1}
                            className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                          >
                            <ArrowDown className="w-4 h-4 text-slate-600" />
                          </button>
                          <button
                            onClick={() => handleEditZone(zone)}
                            className="p-1 hover:bg-blue-50 rounded text-blue-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteZone(zone.id)}
                            className="p-1 hover:bg-red-50 rounded text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="text-xs">
                          <span className="text-slate-600">Boundaries:</span>
                          <div className="text-slate-800 font-mono">
                            X: {boundaries.minX.toFixed(2)}-{boundaries.maxX.toFixed(2)}
                          </div>
                          <div className="text-slate-800 font-mono">
                            Y: {boundaries.minY.toFixed(2)}-{boundaries.maxY.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-xs">
                          <span className="text-slate-600">Max Size:</span>
                          <div className="text-slate-800 font-medium">
                            {spec.maxW}″ × {spec.maxH}″
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <input
                          type="range"
                          min="0"
                          max="0.9"
                          step="0.01"
                          value={boundaries.minX}
                          onChange={(e) => handleUpdateZone(zone.id, {
                            boundaries: { ...boundaries, minX: parseFloat(e.target.value) }
                          })}
                          className="flex-1"
                        />
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.01"
                          value={boundaries.maxX}
                          onChange={(e) => handleUpdateZone(zone.id, {
                            boundaries: { ...boundaries, maxX: parseFloat(e.target.value) }
                          })}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Zone Preview & Edit */}
          <div className="w-1/2 p-6 overflow-y-auto">
            {editingZone ? (
              <div className="space-y-6">
                <h3 className="font-semibold text-slate-800">Edit Zone: {editingZone.name}</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Zone Name
                    </label>
                    <input
                      type="text"
                      value={editingZone.name}
                      onChange={(e) => setEditingZone({...editingZone, name: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Specification Key
                    </label>
                    <select
                      value={editingZone.specKey}
                      onChange={(e) => setEditingZone({...editingZone, specKey: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    >
                      <option value="front">Front</option>
                      <option value="pocket">Pocket</option>
                      <option value="sleeve">Sleeve</option>
                      <option value="back">Back</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Max Width (inches)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="30"
                        value={editingZone.spec?.maxW || 10}
                        onChange={(e) => setEditingZone({
                          ...editingZone,
                          spec: { ...(editingZone.spec || { maxW: 10, maxH: 12 }), maxW: parseFloat(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Max Height (inches)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="30"
                        value={editingZone.spec?.maxH || 12}
                        onChange={(e) => setEditingZone({
                          ...editingZone,
                          spec: { ...(editingZone.spec || { maxW: 10, maxH: 12 }), maxH: parseFloat(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-slate-700">Boundary Coordinates (0-1)</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'minX', label: 'Min X', min: 0, max: 0.9 },
                        { key: 'maxX', label: 'Max X', min: 0.1, max: 1 },
                        { key: 'minY', label: 'Min Y', min: 0, max: 0.9 },
                        { key: 'maxY', label: 'Max Y', min: 0.1, max: 1 }
                      ].map(({ key, label, min, max }) => (
                        <div key={key}>
                          <label className="block text-xs text-slate-600 mb-1">{label}</label>
                          <input
                            type="number"
                            step="0.01"
                            min={min}
                            max={max}
                            value={editingZone.boundaries?.[key] || 0.4}
                            onChange={(e) => setEditingZone({
                              ...editingZone,
                              boundaries: { 
                                ...(editingZone.boundaries || { minX: 0.4, maxX: 0.6, minY: 0.4, maxY: 0.6 }), 
                                [key]: parseFloat(e.target.value) 
                              }
                            })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={saveEdit}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save Changes
                    </button>
                    <button
                      onClick={() => setEditingZone(null)}
                      className="px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="font-semibold text-slate-800">Zone Preview</h3>
                
                <div className="relative h-64 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                  {/* Mockup preview with zones */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200" />
                  
                  {zones.map((zone, index) => {
                    // Safely access boundaries with fallbacks
                    const boundaries = zone.boundaries || { minX: 0.4, maxX: 0.6, minY: 0.4, maxY: 0.6 };
                    
                    return (
                      <div
                        key={zone.id}
                        className="absolute border-2 border-blue-500 bg-blue-500/10"
                        style={{
                          left: `${boundaries.minX * 100}%`,
                          top: `${boundaries.minY * 100}%`,
                          width: `${(boundaries.maxX - boundaries.minX) * 100}%`,
                          height: `${(boundaries.maxY - boundaries.minY) * 100}%`,
                          zIndex: zones.length - index
                        }}
                      >
                        <div className="absolute -top-6 left-0 bg-black/75 text-white text-xs px-2 py-1 rounded">
                          {zone.name}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-slate-700">Zone Summary</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {zones.map(zone => {
                      const boundaries = zone.boundaries || { minX: 0.4, maxX: 0.6, minY: 0.4, maxY: 0.6 };
                      const spec = zone.spec || { maxW: 10, maxH: 12 };
                      
                      return (
                        <div key={zone.id} className="border border-slate-200 rounded-lg p-3">
                          <div className="font-medium text-sm text-slate-800">{zone.name}</div>
                          <div className="text-xs text-slate-600 mt-1">
                            Size: {spec.maxW}×{spec.maxH} inches
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Area: {((boundaries.maxX - boundaries.minX) * 100).toFixed(0)}% × 
                            {((boundaries.maxY - boundaries.minY) * 100).toFixed(0)}%
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            ID: {zone.id}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <div className="text-sm text-slate-600">
                    <p className="font-medium mb-2">Usage Instructions:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Drag boundaries to adjust print areas</li>
                      <li>Set max inches for each zone</li>
                      <li>Images will be constrained within selected zone</li>
                      <li>Reorder zones to control priority</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-100"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setZones(DEFAULT_ZONES)}
              className="px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-100"
            >
              Reset to Defaults
            </button>
            <button
              onClick={handleSaveAll}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save All Zones
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoneManager;