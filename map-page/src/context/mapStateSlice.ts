import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {Map as MapBoxMap} from 'mapbox-gl';
import {RootState} from './store';
import {LayerType} from '../config/types';
import {LayerData, LayerDataTypes, loadLayerData} from './layers/layer-data';

interface DateRange {
  startDate?: number;
  endDate?: number;
}

//we need to get this done fast so I'm just dumping all types and state and everything wherever its most convenient
export type CovidSwitch = "deaths" | "recovered" | "active";

type MapState = {
  layers: LayerType[];
  covidSwitches: {[k in CovidSwitch]:boolean};
  dateRange: DateRange;
  mapboxMap: MapGetter;
  loading: number;
  errors: string[];
  layersData: LayerData<any>[];
};

// MapboxGL's map type contains some kind of cyclic dependency that causes an infinite loop in immers's change
// tracking. To save it off, we wrap it in a JS closure so that Redux just checks the function for changes, rather
// than recursively walking the whole object.
type MapGetter = () => MapBoxMap | undefined;

const initialState: MapState = {
  layers: [],
  dateRange: {} as DateRange,
  mapboxMap: (() => {}) as MapGetter,
  // Keep track of loading state with reference counting
  loading: 0,
  errors: [],
  layersData: [],
  covidSwitches:{active:true,deaths:false,recovered:false}
};

function keepLayer(layer: LayerType, payload: LayerType) {
  // Simple function to control which layers can overlap.
  return payload.type !== layer.type;
}

export const mapStateSlice = createSlice({
  name: 'mapState',
  initialState,
  reducers: {
    addLayer: ({ layers, ...rest }, { payload }: PayloadAction<LayerType>) => ({
      ...rest,
      layers: layers.filter(layer => keepLayer(layer, payload)).concat(payload),
    }),

    removeLayer: (
        { layers, ...rest },
        {payload}: PayloadAction<LayerType>,
    ) => ({
      ...rest,
      layers: layers.filter(({id}) => id !== payload.id),
    }),

    updateDateRange: (state, {payload}: PayloadAction<DateRange>) => ({
      ...state,
      dateRange: payload,
    }),
    toggleCovidSwitch: (state, {payload}: PayloadAction<CovidSwitch>) => {
      const covidSwitchesClone = {...state.covidSwitches};
      covidSwitchesClone[payload] = !covidSwitchesClone[payload];
      return {...state, covidSwitches: covidSwitchesClone};
    },

    setMap: (state, {payload}: PayloadAction<MapGetter>) => ({
      ...state,
      mapboxMap: payload,
    }),

    dismissError: (
        {errors, ...rest},
        {payload}: PayloadAction<string>,
    ) => ({
      ...rest,
      errors: errors.filter(msg => msg !== payload),
    }),
  },
  extraReducers: builder => {
    builder.addCase(
      loadLayerData.fulfilled,
      (
        { layersData, loading, ...rest },
        { payload }: PayloadAction<LayerDataTypes>,
      ) => ({
        ...rest,
        loading: loading - 1,
        layersData: layersData.concat(payload),
      }),
    );

    builder.addCase(
      loadLayerData.rejected,
      ({ loading, errors, ...rest }, action) => ({
        ...rest,
        loading: loading - 1,
        errors: errors.concat(
          action.error.message ? action.error.message : action.error.toString(),
        ),
      }),
    );

    builder.addCase(loadLayerData.pending, ({ loading, ...rest }) => ({
      ...rest,
      loading: loading + 1,
    }));
  },
});

// Getters
export const layersSelector = (state: RootState): MapState['layers'] =>
  state.mapState.layers;
export const dateRangeSelector = (state: RootState): MapState['dateRange'] =>
  state.mapState.dateRange;
export const mapSelector = (state: RootState): MapBoxMap | undefined =>
  state.mapState.mapboxMap();
// TODO: Improve the typing on this function
export const layerDataSelector = (id: string, date?: number) => (
  state: RootState,
): LayerDataTypes | undefined =>
  state.mapState.layersData.find(
    ({ layer, date: dataDate }) =>
      layer.id === id && (!date || date === dataDate),
  );
export const isLoading = (state: RootState): boolean =>
  state.mapState.loading > 0;
export const covidSwitchSelector=(switchType: CovidSwitch)=>(state: RootState): boolean=>{
  return state.mapState.covidSwitches[switchType];
}

// Setters
export const {
  addLayer,
  removeLayer,
  updateDateRange,
  setMap,
  toggleCovidSwitch,
} = mapStateSlice.actions;

export default mapStateSlice.reducer;
