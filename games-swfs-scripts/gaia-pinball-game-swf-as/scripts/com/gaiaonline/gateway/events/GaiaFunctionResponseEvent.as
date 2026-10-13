package com.gaiaonline.gateway.events
{
   import com.gaiaonline.gateway.GaiaFunctionResponse;
   import com.gaiaonline.gateway.IGaiaChannel;
   
   public class GaiaFunctionResponseEvent extends GaiaGatewayEvent
   {
      
      public static const FUNCTION_RESPONSE:String = GaiaGatewayEvent.FUNCTION_RESPONSE;
      
      public static const FUNCTION_ERROR:String = GaiaGatewayEvent.FUNCTION_ERROR;
      
      private var _channel:IGaiaChannel;
      
      private var _data:GaiaFunctionResponse;
      
      public function GaiaFunctionResponseEvent(param1:String, param2:GaiaFunctionResponse, param3:IGaiaChannel = null)
      {
         super(param1);
         this._data = param2;
         this._channel = param3;
      }
      
      public function get data() : GaiaFunctionResponse
      {
         return this._data;
      }
      
      public function get channel() : IGaiaChannel
      {
         return this._channel;
      }
   }
}

