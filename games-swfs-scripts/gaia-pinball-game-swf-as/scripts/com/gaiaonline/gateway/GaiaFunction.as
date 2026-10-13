package com.gaiaonline.gateway
{
   public class GaiaFunction
   {
      
      private static var CID:uint = 0;
      
      protected var _name:String = "";
      
      protected var _args:* = null;
      
      protected var _cid:uint = 0;
      
      public function GaiaFunction(param1:String = null, ... rest)
      {
         super();
         this._cid = ++CID;
         this._name = param1;
         if(rest)
         {
            this._args = rest.length > 1 ? rest : rest[0];
         }
      }
      
      public function fromObject(param1:Object) : void
      {
         if(!param1)
         {
            return;
         }
         if(param1.name != undefined)
         {
            this._name = param1.name;
         }
         if(param1.arg != undefined)
         {
            this._args = param1.args;
         }
      }
      
      public function get name() : String
      {
         return this._name;
      }
      
      public function toObject() : Object
      {
         var _loc1_:Object = null;
         _loc1_ = new Object();
         _loc1_.type = GaiaGatewayProtocol.TYPE_FUNCTION;
         _loc1_.cid = this._cid;
         _loc1_.name = this._name;
         if(this._args != undefined && this._args != null)
         {
            _loc1_.args = this._args;
         }
         return _loc1_;
      }
      
      public function get args() : *
      {
         return this._args;
      }
      
      public function get cid() : uint
      {
         return this._cid;
      }
   }
}

