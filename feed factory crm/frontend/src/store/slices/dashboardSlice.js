import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  data: null,
  loading: false,
  error: null
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setDashboardData: (state, action) => {
      state.data = action.payload;
      state.loading = false;
    },
    setDashboardLoading: (state, action) => {
      state.loading = action.payload;
    },
    setDashboardError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    }
  }
});

export const { setDashboardData, setDashboardLoading, setDashboardError } = dashboardSlice.actions;
export default dashboardSlice.reducer;