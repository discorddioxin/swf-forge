package com.gaiaonline.gateway
{
   public class GaiaFunctionResponse
   {
      
      protected var _error:int = 0;
      
      protected var _name:String = "";
      
      protected var _result:* = null;
      
      protected var _cid:uint = 0;
      
      public function GaiaFunctionResponse(param1:uint, param2:String = null, param3:* = null, param4:int = 0)
      {
         super();
         this._cid = param1;
         this._name = param2;
         this._result = param3;
         this._error = param4;
      }
      
      public function get cid() : uint
      {
         return this._cid;
      }
      
      public function get error() : int
      {
         return this._error;
      }
      
      public function get name() : String
      {
         return this._name;
      }
      
      public function get result() : *
      {
         return this._result;
      }
   }
}

