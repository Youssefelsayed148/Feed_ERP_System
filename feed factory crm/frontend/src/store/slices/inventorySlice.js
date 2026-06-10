import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  projects: [],
  units: [],
  currentUnit: null,
  total: 0,
  page: 1,
  pages: 1,
  loading: false,
  error: null,
  stats: null
};

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setProjects: (state, action) => {
      state.projects = action.payload;
      state.loading = false;
    },
    setUnits: (state, action) => {
      state.units = action.payload.units;
      state.total = action.payload.total;
      state.page = action.payload.page;
      state.pages = action.payload.pages;
      state.loading = false;
    },
    setCurrentUnit: (state, action) => {
      state.currentUnit = action.payload;
      state.loading = false;
    },
    setInventoryLoading: (state, action) => {
      state.loading = action.payload;
    },
    setInventoryError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    setInventoryStats: (state, action) => {
      state.stats = action.payload;
    },
    updateUnit: (state, action) => {
      const index = state.units.findIndex(u => u._id === action.payload._id);
      if (index !== -1) {
        state.units[index] = action.payload;
      }
    }
  }
});

export const { setProjects, setUnits, setCurrentUnit, setInventoryLoading, setInventoryError, setInventoryStats, updateUnit } = inventorySlice.actions;
export default inventorySlice.reducer;