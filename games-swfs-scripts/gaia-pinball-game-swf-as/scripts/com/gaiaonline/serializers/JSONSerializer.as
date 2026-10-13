package com.gaiaonline.serializers
{
   import com.adobe.serialization.json.JSON;
   
   public class JSONSerializer
   {
      
      public static const encodeName:String = "json";
      
      public function JSONSerializer()
      {
         super();
      }
      
      public static function serialize(param1:*) : String
      {
         return com.adobe.serialization.json.JSON.encode(param1);
      }
      
      public static function unserialize(param1:String) : *
      {
         return com.adobe.serialization.json.JSON.decode(param1);
      }
   }
}

