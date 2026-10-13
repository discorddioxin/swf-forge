package com.gaiaonline.gateway.events
{
   import com.gaiaonline.gateway.GaiaFunction;
   import com.gaiaonline.gateway.IGaiaChannel;
   
   public class GaiaFunctionEvent extends GaiaGatewayEvent
   {
      
      public static const FUNCTION_CALL:String = GaiaGatewayEvent.FUNCTION_CALL;
      
      private var _channel:IGaiaChannel;
      
      private var _data:GaiaFunction;
      
      public function GaiaFunctionEvent(param1:String, param2:GaiaFunction, param3:IGaiaChannel = null)
      {
         super(param1);
         this._data = param2;
         this._channel = param3;
      }
      
      public function get data() : GaiaFunction
      {
         return this._data;
      }
      
      public function get channel() : IGaiaChannel
      {
         return this._channel;
      }
   }
}

