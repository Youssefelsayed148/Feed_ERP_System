import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  leads: [],
  currentLead: null,
  total: 0,
  page: 1,
  pages: 1,
  loading: false,
  error: null,
  stats: null
};

const leadsSlice = createSlice({
  name: 'leads',
  initialState,
  reducers: {
    setLeads: (state, action) => {
      state.leads = action.payload.leads;
      state.total = action.payload.total;
      state.page = action.payload.page;
      state.pages = action.payload.pages;
      state.loading = false;
    },
    setCurrentLead: (state, action) => {
      state.currentLead = action.payload;
      state.loading = false;
    },
    setLeadsLoading: (state, action) => {
      state.loading = action.payload;
    },
    setLeadsError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    setLeadsStats: (state, action) => {
      state.stats = action.payload;
    },
    updateLead: (state, action) => {
      const index = state.leads.findIndex(l => l._id === action.payload._id);
      if (index !== -1) {
        state.leads[index] = action.payload;
      }
    },
    addLead: (state, action) => {
      state.leads.unshift(action.payload);
      state.total += 1;
    }
  }
});

export const { setLeads, setCurrentLead, setLeadsLoading, setLeadsError, setLeadsStats, updateLead, addLead } = leadsSlice.actions;
export default leadsSlice.reducer;