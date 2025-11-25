import axios from 'axios';
import {formatInTimeZone} from 'date-fns-tz';

const banxico_url = 'https://www.banxico.org.mx/SieAPIRest/service/v1/series/'
const base_udi_id = 'SP68257'

const udiClientInstance = axios.create({
  baseURL: `${banxico_url}/${base_udi_id}`,
  timeout: 5000,
  headers: {
    'Bmx-Token': process.env.BMX_TOKEN
  }
})

export type UdiDatosResponse = {
  fecha: string
  dato: string
}

type UdiResponse = {
  bmx: {
    series: [{
      datos: [UdiDatosResponse]
    }]

  }
}

export const fetchTodayUdiValue = async (): Promise<UdiResponse> => {
  const today = formatInTimeZone(new Date(), 'UTC', 'yyyy-MM-dd') ;
  const response = await udiClientInstance.get<UdiResponse>(`/datos/${today}/${today}`);
  return response.data;
}
