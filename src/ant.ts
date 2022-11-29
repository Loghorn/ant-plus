export type SendCallback = (result: boolean) => void;
export enum PageState {
  INIT_PAGE,
  STD_PAGE,
  EXT_PAGE,
}

export type Page = {
  oldPage: number;
  pageState: PageState; // sets the state of the receiver - INIT, STD_PAGE, EXT_PAGE
};
