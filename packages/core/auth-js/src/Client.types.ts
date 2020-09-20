export interface ClientConfig {
  headers?: {
    [key: string]: string
  }
}

export interface Subscription {
  id: string
  callback: Function 
  /** Removes the callback function */ 
  unsubscribe: Function
}