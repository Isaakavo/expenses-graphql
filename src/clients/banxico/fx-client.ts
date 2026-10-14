import axios from 'axios';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

const banxicoUrl = 'https://www.banxico.org.mx/SieAPIRest/service/v1/series/';
const fixSeriesId = 'SF43718';
const maxChunkDays = 365;

const fxClientInstance = axios.create({
  baseURL: `${banxicoUrl}${fixSeriesId}`,
  timeout: 10000,
});

export type FixRate = {
  rateDate: string;
  rate: number;
};

type FixDatos = { fecha: string; dato: string };

type FixResponse = {
  bmx: { series: { datos?: FixDatos[] }[] };
};

export const parseFixResponse = (response: FixResponse): FixRate[] =>
  (response.bmx.series[0].datos ?? []).flatMap(({ fecha, dato }) => {
    const [day, month, year] = fecha.split('/');
    const rate = Number(dato);
    return Number.isFinite(rate) && rate > 0
      ? [{ rateDate: `${year}-${month}-${day}`, rate }]
      : [];
  });

const chunkRange = (start: string, end: string): [string, string][] => {
  const spanDays = differenceInCalendarDays(parseISO(end), parseISO(start));
  return [...Array(Math.floor(spanDays / maxChunkDays) + 1).keys()].map((i) => {
    const chunkStart = addDays(parseISO(start), i * maxChunkDays);
    const chunkEnd = addDays(chunkStart, maxChunkDays - 1);
    const lastDay = parseISO(end);
    return [
      format(chunkStart, 'yyyy-MM-dd'),
      format(chunkEnd < lastDay ? chunkEnd : lastDay, 'yyyy-MM-dd'),
    ];
  });
};

export const fetchFixRates = async (start: string, end: string): Promise<FixRate[]> => {
  return chunkRange(start, end).reduce<Promise<FixRate[]>>(
    async (previous, [chunkStart, chunkEnd]) => {
      const collected = await previous;
      const response = await fxClientInstance.get<FixResponse>(
        `/datos/${chunkStart}/${chunkEnd}`,
        { headers: { 'Bmx-Token': process.env.BMX_TOKEN } }
      );
      return [...collected, ...parseFixResponse(response.data)];
    },
    Promise.resolve([])
  );
};
